import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'CAMP_BOSS'));

router.get('/', async (req, res, next) => {
  try {
    const { table_name, user_id, limit = 100 } = req.query;
    const where = {};
    if (table_name) where.table_name = table_name;
    if (user_id) where.user_id = Number(user_id);

    const data = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      include: {
        user: { select: { id: true, full_name: true, username: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;