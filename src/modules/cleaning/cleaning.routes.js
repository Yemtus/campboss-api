import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/tasks', async (req, res, next) => {
  try {
    const data = await prisma.cleaningTask.findMany({
      where: {
        is_active: true,
        ...(req.user.platform_id ? { platform_id: req.user.platform_id } : {}),
      },
      include: {
        logs: {
          orderBy: { logged_at: 'desc' },
          take: 1,
          include: {
            logged_by: { select: { id: true, full_name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks', async (req, res, next) => {
  try {
    const { name, area, frequency, assigned_to } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Task name is required' });
    }
    const data = await prisma.cleaningTask.create({
      data: {
        name,
        area: area || null,
        frequency: frequency || 'daily',
        assigned_to: assigned_to || null,
        platform_id: req.user.platform_id,
        is_active: true,
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/log', async (req, res, next) => {
  try {
    const { notes } = req.body;
    const data = await prisma.cleaningLog.create({
      data: {
        task_id: Number(req.params.id),
        logged_by_id: req.user.id,
        status: 'COMPLETED',
        notes: notes || null,
      },
      include: {
        logged_by: { select: { id: true, full_name: true } },
        task: true,
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const data = await prisma.cleaningLog.findMany({
      orderBy: { logged_at: 'desc' },
      take: 100,
      include: {
        task: true,
        logged_by: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;