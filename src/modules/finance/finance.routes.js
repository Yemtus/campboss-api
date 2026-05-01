import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

// ── CONTRACTS ──────────────────────────────────────────────

router.get('/contracts', async (req, res, next) => {
  try {
    const data = await prisma.contract.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      include: { platform: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/contracts', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { oil_company, contract_type, currency, rate_per_head, fixed_monthly, start_date, end_date, notes } = req.body;
    if (!oil_company || !start_date) {
      return res.status(400).json({ success: false, message: 'Oil company and start date are required' });
    }
    const data = await prisma.contract.create({
      data: {
        platform_id: req.user.platform_id,
        oil_company,
        contract_type: contract_type || 'PER_HEAD',
        currency: currency || 'NGN',
        rate_per_head: rate_per_head ? Number(rate_per_head) : null,
        fixed_monthly: fixed_monthly ? Number(fixed_monthly) : null,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        notes: notes || null,
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.patch('/contracts/:id', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { status, notes, end_date } = req.body;
    const data = await prisma.contract.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(status && { status }),
        ...(notes && { notes }),
        ...(end_date && { end_date: new Date(end_date) }),
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── INVOICES ───────────────────────────────────────────────

router.get('/invoices', async (req, res, next) => {
  try {
    const data = await prisma.invoice.findMany({
      include: {
        contract: { include: { platform: { select: { name: true } } } },
        items: true,
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/invoices/generate', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { contract_id, period_start, period_end, notes } = req.body;
    if (!contract_id || !period_start || !period_end) {
      return res.status(400).json({ success: false, message: 'Contract, period start and end are required' });
    }

    const contract = await prisma.contract.findUnique({ where: { id: Number(contract_id) } });
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    const start = new Date(period_start);
    const end = new Date(period_end);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Get average POB for the period
    const shifts = await prisma.shift.findMany({
      where: {
        platform_id: contract.platform_id,
        date: { gte: start, lte: end },
      },
    });
    const avgPOB = shifts.length > 0
      ? Math.round(shifts.reduce((s, sh) => s + (sh.crew_count || 0), 0) / shifts.length)
      : 0;

    // Calculate amounts
    let subtotal = 0;
    const items = [];

    if (contract.contract_type === 'PER_HEAD') {
      const rate = Number(contract.rate_per_head || 0);
      subtotal = rate * avgPOB * days;
      items.push({
        description: `Catering services — ${avgPOB} persons × ${days} days × ${contract.currency} ${rate.toLocaleString()}/head/day`,
        quantity: avgPOB * days,
        unit_price: rate,
        total: subtotal,
      });
    } else if (contract.contract_type === 'FIXED') {
      subtotal = Number(contract.fixed_monthly || 0);
      items.push({
        description: `Fixed monthly catering fee — ${start.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
        quantity: 1,
        unit_price: subtotal,
        total: subtotal,
      });
    } else {
      // BOTH
      const perHeadAmount = Number(contract.rate_per_head || 0) * avgPOB * days;
      const fixedAmount = Number(contract.fixed_monthly || 0);
      subtotal = perHeadAmount + fixedAmount;
      items.push({
        description: `Per-head catering — ${avgPOB} persons × ${days} days × ${contract.currency} ${Number(contract.rate_per_head).toLocaleString()}/head/day`,
        quantity: avgPOB * days,
        unit_price: Number(contract.rate_per_head),
        total: perHeadAmount,
      });
      items.push({
        description: `Fixed monthly management fee`,
        quantity: 1,
        unit_price: Number(contract.fixed_monthly),
        total: fixedAmount,
      });
    }

    // Generate invoice number
    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        contract_id: Number(contract_id),
        invoice_number: invoiceNumber,
        period_start: start,
        period_end: end,
        total_days: days,
        total_pob: avgPOB,
        subtotal,
        total_amount: subtotal,
        currency: contract.currency,
        status: 'DRAFT',
        notes: notes || null,
        issued_at: new Date(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        items: { create: items },
      },
      include: { items: true, contract: true },
    });

    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

router.patch('/invoices/:id/status', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const data = await prisma.invoice.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        ...(status === 'PAID' && { paid_at: new Date() }),
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── SUPPLIER PAYMENTS ──────────────────────────────────────

router.get('/supplier-payments', async (req, res, next) => {
  try {
    const data = await prisma.supplierPayment.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      include: { recorded_by: { select: { id: true, full_name: true } } },
      orderBy: { payment_date: 'desc' },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/supplier-payments', async (req, res, next) => {
  try {
    const { supplier_name, amount, currency, payment_date, payment_method, reference, notes } = req.body;
    if (!supplier_name || !amount || !payment_date) {
      return res.status(400).json({ success: false, message: 'Supplier, amount and date are required' });
    }
    const data = await prisma.supplierPayment.create({
      data: {
        supplier_name,
        amount: Number(amount),
        currency: currency || 'NGN',
        payment_date: new Date(payment_date),
        payment_method: payment_method || 'BANK_TRANSFER',
        reference: reference || null,
        notes: notes || null,
        recorded_by_id: req.user.id,
        platform_id: req.user.platform_id,
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── FINANCE SETTINGS ───────────────────────────────────────

router.get('/settings', async (req, res, next) => {
  try {
    const data = await prisma.financeSettings.findUnique({
      where: { platform_id: req.user.platform_id },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/settings', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { company_name, company_address, company_email, company_phone, bank_name, account_number, account_name } = req.body;
    const data = await prisma.financeSettings.upsert({
      where: { platform_id: req.user.platform_id },
      update: { company_name, company_address, company_email, company_phone, bank_name, account_number, account_name },
      create: { platform_id: req.user.platform_id, company_name, company_address, company_email, company_phone, bank_name, account_number, account_name },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── P&L SUMMARY ────────────────────────────────────────────

router.get('/pnl', async (req, res, next) => {
  try {
    const platformId = req.user.platform_id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [invoices, expenses, supplierPayments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          status: 'PAID',
          period_start: { gte: startOfMonth },
          contract: { platform_id: platformId },
        },
        include: { contract: true },
      }),
      prisma.expense.findMany({
        where: { created_at: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.supplierPayment.findMany({
        where: {
          platform_id: platformId,
          payment_date: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ]);

    const revenue = invoices.reduce((s, inv) => s + Number(inv.total_amount), 0);
    const foodCost = expenses.filter(e => e.category === 'FOOD').reduce((s, e) => s + Number(e.amount), 0);
    const otherCost = expenses.filter(e => e.category !== 'FOOD').reduce((s, e) => s + Number(e.amount), 0);
    const supplierCost = supplierPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalCost = foodCost + otherCost + supplierCost;
    const netMargin = revenue - totalCost;
    const marginPct = revenue > 0 ? ((netMargin / revenue) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        period: `${startOfMonth.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
        revenue,
        foodCost,
        otherCost,
        supplierCost,
        totalCost,
        netMargin,
        marginPct,
      },
    });
  } catch (err) { next(err); }
});

export default router;