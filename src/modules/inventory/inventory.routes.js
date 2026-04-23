import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { listItems, createItem, updateItem, addBatch, importItems } from './inventory.service.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const data = await listItems(req.user.platform_id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = await createItem(req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = await updateItem(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/batches', async (req, res, next) => {
  try {
    const data = await addBatch(req.params.id, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/import', async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: 'rows array is required' });
    }
    const data = await importItems(rows, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;