import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/periods', async (req, res, next) => {
  try {
    const data = await prisma.budgetPeriod.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      orderBy: { start_date: 'desc' },
      include: {
        expenses: { select: { amount: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/periods', async (req, res, next) => {
  try {
    const { name, period_type, start_date, end_date, total_budget, notes } = req.body;
    if (!name || !start_date || !end_date || !total_budget) {
      return res.status(400).json({ success: false, message: 'Name, dates and budget are required' });
    }
    const data = await prisma.budgetPeriod.create({
      data: {
        name,
        period_type: period_type || 'monthly',
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        total_budget: Number(total_budget),
        notes: notes || null,
        created_by: req.user.id,
        platform_id: req.user.platform_id,
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/expenses', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.budget_period_id) {
      where.budget_period_id = Number(req.query.budget_period_id);
    }
    const data = await prisma.expense.findMany({
      where,
      orderBy: { expense_date: 'desc' },
      include: {
        recorder: { select: { id: true, full_name: true } },
        budget_period: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/expenses', async (req, res, next) => {
  try {
    const { budget_period_id, category, description, amount, expense_date, notes } = req.body;
    if (!category || !description || !amount || !expense_date) {
      return res.status(400).json({ success: false, message: 'Category, description, amount and date are required' });
    }
    const data = await prisma.expense.create({
      data: {
        budget_period_id: budget_period_id ? Number(budget_period_id) : null,
        category,
        description,
        amount: Number(amount),
        expense_date: new Date(expense_date),
        notes: notes || null,
        recorded_by: req.user.id,
      },
      include: {
        recorder: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/cost-per-head', async (req, res, next) => {
  try {
    const foodSpend = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { category: { in: ['FOOD', 'PROVISIONS', 'CATERING'] } },
    });

    const shifts = await prisma.shift.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      select: { crew_count: true },
    });

    const totalSpend = Number(foodSpend._sum.amount || 0);
    const personDays = shifts.reduce((sum, s) => sum + (s.crew_count || 0) / 2, 0);
    const costPerHead = personDays > 0 ? Math.round(totalSpend / personDays) : 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayShifts = await prisma.shift.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        status: 'open',
        ...(req.user.platform_id ? { platform_id: req.user.platform_id } : {}),
      },
      select: { crew_count: true },
    });

    const currentPOB = todayShifts.reduce((sum, s) => sum + (s.crew_count || 0), 0);

    res.json({
      success: true,
      data: { totalSpend, personDays, costPerHead, currentPOB, currency: 'NGN' },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/waste', async (req, res, next) => {
  try {
    const data = await prisma.wasteLog.findMany({
      orderBy: { waste_date: 'desc' },
      include: {
        item: { select: { id: true, name: true } },
        recorder: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/waste', async (req, res, next) => {
  try {
    const { item_id, description, quantity, unit, cost, reason, waste_date } = req.body;
    if (!description || !quantity || !unit || !waste_date) {
      return res.status(400).json({ success: false, message: 'Description, quantity, unit and date are required' });
    }
    const data = await prisma.wasteLog.create({
      data: {
        item_id: item_id ? Number(item_id) : null,
        description,
        quantity: Number(quantity),
        unit,
        cost: cost ? Number(cost) : null,
        reason: reason || null,
        waste_date: new Date(waste_date),
        recorded_by: req.user.id,
      },
      include: {
        recorder: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;