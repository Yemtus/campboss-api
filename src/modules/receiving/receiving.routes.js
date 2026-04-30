import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';
import { uploadPhoto } from '../../services/cloudinary.service.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const data = await prisma.receivingCheck.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      orderBy: { checked_at: 'desc' },
      include: {
        checked_by: { select: { id: true, full_name: true } },
        signed_by: { select: { id: true, full_name: true } },
        photos: true,
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { supplier, invoice_no, items_summary, status, notes } = req.body;
    if (!supplier) {
      return res.status(400).json({ success: false, message: 'Supplier is required' });
    }
    const data = await prisma.receivingCheck.create({
      data: {
        supplier,
        invoice_no: invoice_no || null,
        items_summary: items_summary || null,
        status: status || 'ACCEPTED',
        notes: notes || null,
        checked_by_id: req.user.id,
        platform_id: req.user.platform_id,
      },
      include: {
        checked_by: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/sign', async (req, res, next) => {
  try {
    const check = await prisma.receivingCheck.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!check) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    if (check.signed_by_id) {
      return res.status(400).json({ success: false, message: 'Already signed off' });
    }
    const data = await prisma.receivingCheck.update({
      where: { id: Number(req.params.id) },
      data: {
        signed_by_id: req.user.id,
        signed_at: new Date(),
        sign_device: req.headers['user-agent'] || 'Web',
      },
      include: {
        checked_by: { select: { id: true, full_name: true } },
        signed_by: { select: { id: true, full_name: true } },
      },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/photos', async (req, res, next) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ success: false, message: 'Photo data is required' });
    }

    const check = await prisma.receivingCheck.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!check) {
      return res.status(404).json({ success: false, message: 'Receiving check not found' });
    }

    const uploaded = await uploadPhoto(photo, 'campboss/receiving');
    if (!uploaded.success) {
      return res.status(500).json({ success: false, message: 'Photo upload failed', error: uploaded.error });
    }

    

    res.json({ success: true, data: photoRecord });
  } catch (err) {
    next(err);
  }
});

export default router;const photoRecord = await prisma.photoEvidence.create({
  data: {
    receiving_check_id: Number(req.params.id),
    url: uploaded.url,
    uploaded_by_id: req.user.id,
  },
});