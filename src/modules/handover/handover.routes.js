import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const data = await prisma.handoverReport.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      orderBy: { created_at: 'desc' },
      include: {
        author: { select: { id: true, full_name: true } },
        signed_by: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { shift, date, summary, notes } = req.body;
    if (!shift || !date) {
      return res.status(400).json({ success: false, message: 'Shift and date are required' });
    }
    const data = await prisma.handoverReport.create({
      data: {
        shift,
        date: new Date(date),
        summary: summary || null,
        notes: notes || null,
        status: 'draft',
        author_id: req.user.id,
        platform_id: req.user.platform_id,
      },
      include: {
        author: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/sign', async (req, res, next) => {
  try {
    const report = await prisma.handoverReport.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    if (report.signed_by_id) {
      return res.status(400).json({ success: false, message: 'Already signed off' });
    }
    const data = await prisma.handoverReport.update({
      where: { id: Number(req.params.id) },
      data: {
        signed_by_id: req.user.id,
        signed_at: new Date(),
        sign_device: req.headers['user-agent'] || 'Web',
        status: 'submitted',
      },
      include: {
        author: { select: { id: true, full_name: true } },
        signed_by: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;