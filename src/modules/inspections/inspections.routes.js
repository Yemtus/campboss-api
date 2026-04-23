import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const data = await prisma.inspection.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      orderBy: { conducted_at: 'desc' },
      include: {
        inspector: { select: { id: true, full_name: true } },
        items: true,
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, type, notes, items } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const scoredItems = (items || []).filter(i => i.result !== 'NA');
    const score = scoredItems.length > 0
      ? Math.round((scoredItems.filter(i => i.result === 'PASS').length / scoredItems.length) * 100)
      : null;

    const data = await prisma.inspection.create({
      data: {
        title,
        type: type || 'INTERNAL',
        notes: notes || null,
        score,
        status: 'COMPLETED',
        inspector_id: req.user.id,
        platform_id: req.user.platform_id,
        items: {
          create: (items || []).map(item => ({
            label: item.label,
            category: item.category || null,
            result: item.result || 'PASS',
            notes: item.notes || null,
          })),
        },
      },
      include: {
        inspector: { select: { id: true, full_name: true } },
        items: true,
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await prisma.inspection.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        inspector: { select: { id: true, full_name: true } },
        items: true,
      },
    });
    if (!data) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;