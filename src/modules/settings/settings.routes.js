import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();

router.get('/branding', async (req, res, next) => {
  try {
    const rows = await prisma.systemSetting.findMany();
    const branding = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ success: true, data: branding });
  } catch (err) {
    next(err);
  }
});

router.patch('/branding', authenticate, requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
});

router.get('/platforms', authenticate, async (req, res, next) => {
  try {
    const data = await prisma.platform.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;