import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/shifts', async (req, res, next) => {
  try {
    const data = await prisma.shift.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      orderBy: { date: 'desc' },
      include: {
        creator: { select: { id: true, full_name: true } },
        attendances: {
          include: {
            user: { select: { id: true, full_name: true, role: true } },
          },
        },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/shifts', async (req, res, next) => {
  try {
    const { name, shift_type, date, crew_count, notes } = req.body;
    if (!name || !date) {
      return res.status(400).json({ success: false, message: 'Name and date are required' });
    }
    const data = await prisma.shift.create({
      data: {
        name,
        shift_type: shift_type || 'morning',
        date: new Date(date),
        crew_count: Number(crew_count) || 0,
        notes: notes || null,
        status: 'open',
        created_by: req.user.id,
        platform_id: req.user.platform_id,
      },
      include: {
        creator: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.patch('/shifts/:id/close', async (req, res, next) => {
  try {
    const data = await prisma.shift.update({
      where: { id: Number(req.params.id) },
      data: { status: 'closed', updated_at: new Date() },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/pob/live', async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const shifts = await prisma.shift.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        status: 'open',
        ...(req.user.platform_id ? { platform_id: req.user.platform_id } : {}),
      },
      select: { crew_count: true },
    });

    const pob = shifts.reduce((sum, s) => sum + (s.crew_count || 0), 0);
    res.json({ success: true, data: { pob, asOf: new Date() } });
  } catch (err) {
    next(err);
  }
});

router.get('/pob/history', async (req, res, next) => {
  try {
    const days = Number(req.query.days || 14);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const shifts = await prisma.shift.findMany({
      where: {
        date: { gte: since },
        ...(req.user.platform_id ? { platform_id: req.user.platform_id } : {}),
      },
      select: { date: true, crew_count: true },
      orderBy: { date: 'asc' },
    });

    const byDate = {};
    shifts.forEach(s => {
      const d = s.date.toISOString().split('T')[0];
      byDate[d] = Math.max(byDate[d] || 0, s.crew_count || 0);
    });

    const data = Object.entries(byDate).map(([date, pob]) => ({ date, pob }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;