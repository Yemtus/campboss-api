import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import prisma from '../../database/prisma.js';

const router = Router();
router.use(authenticate);

// Get all equipment
router.get('/', async (req, res, next) => {
  try {
    const data = await prisma.equipment.findMany({
      where: req.user.platform_id ? { platform_id: req.user.platform_id } : {},
      include: { logs: { orderBy: { created_at: 'desc' }, take: 3 } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Add equipment
router.post('/', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { name, equipment_type, model, serial_number, installation_date, next_service_date, notes } = req.body;
    if (!name || !equipment_type) {
      return res.status(400).json({ success: false, message: 'Name and type are required' });
    }
    const data = await prisma.equipment.create({
      data: {
        name,
        equipment_type,
        model: model || null,
        serial_number: serial_number || null,
        installation_date: installation_date ? new Date(installation_date) : null,
        next_service_date: next_service_date ? new Date(next_service_date) : null,
        notes: notes || null,
        platform_id: req.user.platform_id,
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Update equipment status
router.patch('/:id', requireRole('SUPER_ADMIN', 'CAMP_BOSS'), async (req, res, next) => {
  try {
    const { status, last_service_date, next_service_date, notes } = req.body;
    const data = await prisma.equipment.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(status && { status }),
        ...(last_service_date && { last_service_date: new Date(last_service_date) }),
        ...(next_service_date && { next_service_date: new Date(next_service_date) }),
        ...(notes && { notes }),
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Add equipment log
router.post('/:id/logs', async (req, res, next) => {
  try {
    const { log_type, description } = req.body;
    if (!log_type || !description) {
      return res.status(400).json({ success: false, message: 'Log type and description are required' });
    }
    const data = await prisma.equipmentLog.create({
      data: {
        equipment_id: Number(req.params.id),
        log_type,
        description,
        logged_by_id: req.user.id,
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Proactive detection — check for repeated HACCP failures and flag equipment
router.post('/detect', async (req, res, next) => {
  try {
    const platformId = req.user.platform_id;
    const since = new Date();
    since.setDate(since.getDate() - 7);

    // Get all HACCP failures in last 7 days
    const failures = await prisma.haccpCheck.findMany({
      where: {
        result: 'FAIL',
        checked_at: { gte: since },
        ...(platformId ? { platform_id: platformId } : {}),
      },
      include: { point: true },
    });

    // Group by monitoring point name
    const failCounts = {};
    failures.forEach(f => {
      const key = f.point?.name || 'Unknown';
      failCounts[key] = (failCounts[key] || 0) + 1;
    });

    // Find equipment matching points with 3+ failures
    const alerts = [];
    for (const [pointName, count] of Object.entries(failCounts)) {
      if (count >= 3) {
        // Find matching equipment by name similarity
        const equipment = await prisma.equipment.findMany({
          where: {
            ...(platformId ? { platform_id: platformId } : {}),
            status: { not: 'NEEDS_SERVICE' },
            name: { contains: pointName.split(' ')[0] },
          },
        });

        for (const eq of equipment) {
          // Flag as needs service
          await prisma.equipment.update({
            where: { id: eq.id },
            data: { status: 'NEEDS_SERVICE' },
          });

          // Create notification
          await prisma.notification.create({
            data: {
              type: 'ALERT',
              title: `Equipment Alert — ${eq.name}`,
              message: `${eq.name} has triggered ${count} HACCP failures in 7 days. Maintenance required.`,
            },
          });

          // Log it
          await prisma.equipmentLog.create({
            data: {
              equipment_id: eq.id,
              log_type: 'AUTO_DETECTED',
              description: `System automatically flagged: ${count} HACCP failures in 7 days on ${pointName}.`,
              logged_by_id: req.user.id,
            },
          });

          alerts.push({ equipment: eq.name, failures: count });
        }
      }
    }

    res.json({ success: true, data: { alerts, checked: Object.keys(failCounts).length } });
  } catch (err) { next(err); }
});

export default router;