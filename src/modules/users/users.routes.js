import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// Get all users
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        platform_id: true,
        is_active: true,
        created_at: true,
        platform: { select: { name: true } },
      },
      orderBy: { full_name: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// Create user
router.post('/', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { username, password, full_name, role, platform_id } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, password and full name are required' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        password_hash,
        full_name,
        role: role || 'SUPERVISOR',
        platform_id: platform_id ? Number(platform_id) : null,
        is_active: true,
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        platform_id: true,
        is_active: true,
      },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    next(err);
  }
});

// Update user
router.patch('/:id', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { full_name, role, platform_id, is_active, password } = req.body;
    const data = {};
    if (full_name) data.full_name = full_name;
    if (role) data.role = role;
    if (platform_id !== undefined) data.platform_id = platform_id ? Number(platform_id) : null;
    if (is_active !== undefined) data.is_active = is_active;
    if (password) data.password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data,
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        platform_id: true,
        is_active: true,
      },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// Deactivate user
router.delete('/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { is_active: false },
    });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;