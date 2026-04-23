import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.unread_only === 'true') where.is_read = false;

    const data = await prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { is_read: false },
    });
    res.json({ success: true, count });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    await prisma.notification.update({
      where: { id: Number(req.params.id) },
      data: { is_read: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/mark-all-read', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { is_read: false },
      data: { is_read: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/sms-log', async (req, res, next) => {
  try {
    const data = await prisma.smsLog.findMany({
      orderBy: { sent_at: 'desc' },
      take: 50,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;