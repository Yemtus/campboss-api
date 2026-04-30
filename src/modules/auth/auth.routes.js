import { Router } from 'express';
import { login, refresh, logout } from './auth.service.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../services/audit.service.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    const data = await login(username, password);
    await logAudit({
      user_id: data.user.id,
      action: 'LOGIN',
      table_name: 'users',
      record_id: data.user.id,
      new_values: { username: data.user.username, role: data.user.role },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }
    const data = await refresh(refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await logout(refreshToken);
    await logAudit({
      user_id: req.user.id,
      action: 'LOGOUT',
      table_name: 'users',
      record_id: req.user.id,
      new_values: { username: req.user.username },
      req,
    });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, data: req.user });
});

export default router;