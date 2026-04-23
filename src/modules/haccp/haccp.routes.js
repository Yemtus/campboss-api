import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { listPoints, listChecks, createCheck, signCheck } from './haccp.service.js';

const router = Router();
router.use(authenticate);

router.get('/points', async (req, res, next) => {
  try {
    const data = await listPoints(req.user.platform_id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/checks', async (req, res, next) => {
  try {
    const data = await listChecks(req.user.platform_id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/checks', async (req, res, next) => {
  try {
    const data = await createCheck(req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/checks/:id/sign', async (req, res, next) => {
  try {
    const data = await signCheck(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;