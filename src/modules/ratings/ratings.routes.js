import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();

// PUBLIC — no auth needed — crew submit ratings via QR code
router.post('/submit', async (req, res, next) => {
  try {
    const { platform_id, meal_date, meal_type, rating, comment } = req.body;
    if (!platform_id || !meal_type || !rating) {
      return res.status(400).json({ success: false, message: 'Platform, meal type and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }
    const data = await prisma.mealRating.create({
      data: {
        platform_id: Number(platform_id),
        meal_date: meal_date ? new Date(meal_date) : new Date(),
        meal_type,
        rating: Number(rating),
        comment: comment || null,
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PROTECTED — camp boss sees ratings dashboard
router.get('/', authenticate, async (req, res, next) => {
  try {
    const platformId = req.user.platform_id;
    const days = Number(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const ratings = await prisma.mealRating.findMany({
      where: {
        ...(platformId ? { platform_id: platformId } : {}),
        created_at: { gte: since },
      },
      orderBy: { created_at: 'desc' },
    });

    // Stats
    const total = ratings.length;
    const avg = total > 0 ? (ratings.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : 0;
    const byMealType = ['BREAKFAST', 'LUNCH', 'DINNER'].map(type => {
      const typeRatings = ratings.filter(r => r.meal_type === type);
      return {
        meal_type: type,
        count: typeRatings.length,
        avg: typeRatings.length > 0 ? (typeRatings.reduce((s, r) => s + r.rating, 0) / typeRatings.length).toFixed(1) : 0,
      };
    });

    const distribution = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: ratings.filter(r => r.rating === star).length,
    }));

    res.json({
      success: true,
      data: { ratings, total, avg, byMealType, distribution },
    });
  } catch (err) { next(err); }
});

export default router;