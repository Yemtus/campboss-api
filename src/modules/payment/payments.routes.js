import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ── HELPER ────────────────────────────────────────────────
async function paystackRequest(method, endpoint, data = null) {
  const res = await axios({
    method,
    url: `https://api.paystack.co${endpoint}`,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    data,
  });
  return res.data;
}

// ── INITIALIZE INVOICE PAYMENT ────────────────────────────
router.post('/invoice/initialize', authenticate, async (req, res, next) => {
  try {
    const { invoice_id } = req.body;
    if (!invoice_id) {
      return res.status(400).json({ success: false, message: 'Invoice ID required' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(invoice_id) },
      include: { contract: true },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Invoice already paid' });
    }

    // Idempotency - use invoice number as reference
    const reference = `CB-INV-${invoice.invoice_number}-${Date.now()}`;

    const response = await paystackRequest('POST', '/transaction/initialize', {
      email: req.user.email || `${req.user.username}@campboss.app`,
      amount: Math.round(Number(invoice.total_amount) * 100), // kobo
      currency: invoice.currency === 'NGN' ? 'NGN' : 'NGN',
      reference,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        camp_boss_user_id: req.user.id,
        payment_type: 'INVOICE',
      },
      callback_url: `${process.env.FRONTEND_URL || 'https://campapp-gamma.vercel.app'}/finance`,
    });

    // Save pending transaction
    await prisma.paymentTransaction.create({
      data: {
        reference,
        type: 'INVOICE',
        amount: Number(invoice.total_amount),
        currency: invoice.currency,
        status: 'PENDING',
        invoice_id: invoice.id,
        initiated_by_id: req.user.id,
        provider: 'PAYSTACK',
        metadata: JSON.stringify({ invoice_number: invoice.invoice_number }),
      },
    });

    res.json({
      success: true,
      data: {
        authorization_url: response.data.authorization_url,
        reference,
        amount: invoice.total_amount,
      },
    });
  } catch (err) {
    console.error('[Payments]', err.response?.data || err.message);
    next(err);
  }
});

// ── INITIALIZE SUBSCRIPTION PAYMENT ───────────────────────
router.post('/subscription/initialize', async (req, res, next) => {
  try {
    const { name, company, email, phone, plan } = req.body;

    if (!name || !email || !plan) {
      return res.status(400).json({ success: false, message: 'Name, email and plan are required' });
    }

    const plans = {
      starter: { amount: 8000000, name: 'Camp Boss Starter', interval: 'monthly' },
      pro: { amount: 15000000, name: 'Camp Boss Pro', interval: 'monthly' },
    };

    const selectedPlan = plans[plan];
    if (!selectedPlan) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }

    const reference = `CB-SUB-${plan.toUpperCase()}-${Date.now()}`;

    const response = await paystackRequest('POST', '/transaction/initialize', {
      email,
      amount: selectedPlan.amount,
      currency: 'NGN',
      reference,
      metadata: {
        name,
        company,
        phone,
        plan,
        payment_type: 'SUBSCRIPTION',
      },
      callback_url: `${process.env.FRONTEND_URL || 'https://campboss-landing.vercel.app'}`,
    });

    res.json({
      success: true,
      data: {
        authorization_url: response.data.authorization_url,
        reference,
        amount: selectedPlan.amount / 100,
        plan: selectedPlan.name,
      },
    });
  } catch (err) {
    console.error('[Payments]', err.response?.data || err.message);
    next(err);
  }
});

// ── VERIFY PAYMENT ─────────────────────────────────────────
router.get('/verify/:reference', authenticate, async (req, res, next) => {
  try {
    const { reference } = req.params;

    const response = await paystackRequest('GET', `/transaction/verify/${reference}`);
    const data = response.data;

    if (data.status === 'success') {
      // Update transaction
      await prisma.paymentTransaction.updateMany({
        where: { reference },
        data: { status: 'SUCCESS', paid_at: new Date() },
      });

      // If invoice payment - mark invoice as paid
      const tx = await prisma.paymentTransaction.findFirst({ where: { reference } });
      if (tx?.invoice_id) {
        await prisma.invoice.update({
          where: { id: tx.invoice_id },
          data: { status: 'PAID', paid_at: new Date() },
        });
      }

      res.json({ success: true, data: { status: 'success', reference } });
    } else {
      res.json({ success: false, data: { status: data.status, reference } });
    }
  } catch (err) {
    next(err);
  }
});

// ── WEBHOOK ────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = req.body;
    const { reference } = event.data;

    // Idempotency check - don't process same event twice
    const existing = await prisma.paymentTransaction.findFirst({
      where: { reference, status: 'SUCCESS' },
    });

    if (existing) {
      return res.sendStatus(200);
    }

    if (event.event === 'charge.success') {
      await prisma.paymentTransaction.updateMany({
        where: { reference },
        data: { status: 'SUCCESS', paid_at: new Date() },
      });

      const tx = await prisma.paymentTransaction.findFirst({ where: { reference } });

      // Auto-mark invoice as paid
      if (tx?.invoice_id) {
        await prisma.invoice.update({
          where: { id: tx.invoice_id },
          data: { status: 'PAID', paid_at: new Date() },
        });

        await prisma.notification.create({
          data: {
            type: 'INFO',
            title: 'Invoice Payment Received',
            message: `Payment of ${tx.currency} ${tx.amount.toLocaleString()} received via Paystack.`,
          },
        });
      }

      // Auto-provision new Camp Boss client
      if (event.data.metadata?.payment_type === 'SUBSCRIPTION') {
        const { name, company, phone, plan } = event.data.metadata;
        console.log(`[Payments] New subscription: ${company} - ${plan}`);
        // TODO: auto-create company account here
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Webhook]', err.message);
    res.sendStatus(500);
  }
});

// ── TRANSACTION HISTORY ────────────────────────────────────
router.get('/transactions', authenticate, async (req, res, next) => {
  try {
    const data = await prisma.paymentTransaction.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        invoice: { select: { invoice_number: true } },
        initiated_by: { select: { full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;