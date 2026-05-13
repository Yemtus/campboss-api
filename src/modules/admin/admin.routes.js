import { Router } from 'express';
import prisma from '../../database/prisma.js';

const router = Router();

// Secret key to protect the endpoint
const RESET_SECRET = process.env.DEMO_RESET_SECRET || 'campboss-reset-2026';

router.post('/reset-demo', async (req, res) => {
  try {
    const { secret } = req.body;
    if (secret !== RESET_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get demo user
    const demoUser = await prisma.user.findFirst({ where: { username: 'demo' } });
    const platform = await prisma.platform.findFirst();

    if (!demoUser || !platform) {
      return res.status(404).json({ success: false, message: 'Demo user or platform not found' });
    }

    // Wipe demo data
   await prisma.smsLog.deleteMany({});
await prisma.notification.deleteMany({});
await prisma.auditLog.deleteMany({ where: { user_id: demoUser.id } });
await prisma.mealRating.deleteMany({ where: { platform_id: platform.id } });
await prisma.equipmentLog.deleteMany({});
await prisma.equipment.deleteMany({ where: { platform_id: platform.id } });
await prisma.inspectionItem.deleteMany({});
await prisma.inspection.deleteMany({ where: { platform_id: platform.id } });
await prisma.handoverReport.deleteMany({ where: { platform_id: platform.id } });
await prisma.invoiceItem.deleteMany({});
await prisma.invoice.deleteMany({});
await prisma.contract.deleteMany({ where: { platform_id: platform.id } });
await prisma.supplierPayment.deleteMany({ where: { platform_id: platform.id } });
await prisma.expense.deleteMany({ where: { recorder: { id: demoUser.id } } });
await prisma.shift.deleteMany({ where: { creator: { id: demoUser.id } } });
await prisma.receivingCheck.deleteMany({ where: { checked_by_id: demoUser.id } });
await prisma.haccpCheck.deleteMany({ where: { checked_by_id: demoUser.id } });
const itemIds = await prisma.inventoryItem.findMany({ where: { platform_id: platform.id }, select: { id: true } });
const ids = itemIds.map(i => i.id);
await prisma.inventoryBatch.deleteMany({ where: { item_id: { in: ids } } });
await prisma.inventoryItem.deleteMany({ where: { platform_id: platform.id } });

    // Reseed HACCP checks
    const haccpPoints = await prisma.haccpMonitoringPoint.findMany({ take: 4 });
    const haccpData = [
      { result: 'PASS', temperature: -17, corrective_action: null, daysAgo: 0 },
      { result: 'PASS', temperature: -16, corrective_action: null, daysAgo: 0 },
      { result: 'FAIL', temperature: -10, corrective_action: 'Compressor checked and reset.', daysAgo: 1 },
      { result: 'WARNING', temperature: -14, corrective_action: 'Door seal inspected.', daysAgo: 1 },
      { result: 'PASS', temperature: 74, corrective_action: null, daysAgo: 2 },
      { result: 'PASS', temperature: -18, corrective_action: null, daysAgo: 2 },
      { result: 'FAIL', temperature: 62, corrective_action: 'Food discarded per HACCP protocol.', daysAgo: 3 },
      { result: 'PASS', temperature: 76, corrective_action: null, daysAgo: 3 },
    ];

    for (let i = 0; i < haccpData.length; i++) {
      const d = haccpData[i];
      const point = haccpPoints[i % haccpPoints.length];
      const date = new Date();
      date.setDate(date.getDate() - d.daysAgo);
      await prisma.haccpCheck.create({
        data: {
          point_id: point.id,
          temperature: d.temperature,
          result: d.result,
          corrective_action: d.corrective_action,
          checked_by_id: demoUser.id,
          platform_id: platform.id,
          checked_at: date,
        },
      });
    }

    // Reseed inventory
    const inventoryItems = [
      { name: 'Rice (50kg bags)', category: 'DRY_GOODS', reorder_threshold: 5, storage_location: 'Dry Store A' },
      { name: 'Chicken (Frozen)', category: 'PROTEIN', reorder_threshold: 20, storage_location: 'Freezer #1' },
      { name: 'Vegetable Oil', category: 'CONDIMENTS', reorder_threshold: 5, storage_location: 'Dry Store B' },
      { name: 'Tomato Paste', category: 'CONDIMENTS', reorder_threshold: 10, storage_location: 'Dry Store A' },
      { name: 'Fresh Vegetables', category: 'PRODUCE', reorder_threshold: 15, storage_location: 'Cold Room' },
      { name: 'Beef (Frozen)', category: 'PROTEIN', reorder_threshold: 20, storage_location: 'Freezer #2' },
    ];

    for (const item of inventoryItems) {
      await prisma.inventoryItem.create({
        data: {
          name: item.name,
          category: item.category,
          reorder_threshold: item.reorder_threshold,
          storage_location: item.storage_location,
          unit_of_measure: 'kg',
          platform_id: platform.id,
        },
      });
    }

    // Reseed receiving
    const deliveries = [
      { supplier: 'Zenith Foods Ltd', invoice_no: 'ZFL-2026-0412', items_summary: 'Frozen chicken 80kg, Beef 60kg', status: 'ACCEPTED', daysAgo: 1 },
      { supplier: 'Niger Delta Provisions', invoice_no: 'NDP-0389', items_summary: 'Rice 24 bags, Vegetable oil 15L', status: 'ACCEPTED', daysAgo: 3 },
      { supplier: 'Fresh Farm Supplies', invoice_no: 'FFS-2026-201', items_summary: 'Fresh vegetables 45kg', status: 'PARTIAL', daysAgo: 5 },
    ];

    for (const delivery of deliveries) {
      const date = new Date();
      date.setDate(date.getDate() - delivery.daysAgo);
      await prisma.receivingCheck.create({
        data: {
          supplier: delivery.supplier,
          invoice_no: delivery.invoice_no,
          items_summary: delivery.items_summary,
          status: delivery.status,
          checked_by_id: demoUser.id,
          platform_id: platform.id,
          checked_at: date,
        },
      });
    }

    // Reseed expenses
    const expenseList = [
      { category: 'FOOD', description: 'Weekly protein stock — Zenith Foods', amount: 485000, daysAgo: 1 },
      { category: 'FOOD', description: 'Dry goods — Niger Delta Provisions', amount: 320000, daysAgo: 3 },
      { category: 'CONSUMABLES', description: 'Cleaning supplies', amount: 42000, daysAgo: 4 },
      { category: 'EQUIPMENT', description: 'Replacement food thermometer', amount: 18500, daysAgo: 6 },
      { category: 'UTILITIES', description: 'Gas cylinders x4', amount: 64000, daysAgo: 8 },
    ];

    for (const exp of expenseList) {
      const date = new Date();
      date.setDate(date.getDate() - exp.daysAgo);
      await prisma.expense.create({
        data: {
          category: exp.category,
          description: exp.description,
          amount: exp.amount,
          expense_date: date,
          recorder: { connect: { id: demoUser.id } },
        },
      });
    }

    // Reseed shifts
    const pobCounts = [62, 58, 65, 61, 60, 63, 59];
    for (let i = 0; i < pobCounts.length; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      await prisma.shift.create({
        data: {
          name: `Day Shift - ${date.toLocaleDateString('en-GB')}`,
          date,
          shift_type: 'DAY',
          crew_count: pobCounts[i],
          platform: { connect: { id: platform.id } },
          creator: { connect: { id: demoUser.id } },
        },
      });
    }

    // Reseed notifications
    await prisma.notification.createMany({
      data: [
        { type: 'ALERT', title: 'HACCP FAIL — Walk-in Freezer #1', message: 'Temperature -10°C outside range.', is_read: false },
        { type: 'ALERT', title: 'HACCP FAIL — Hot Holding Unit', message: 'Temperature 62°C below minimum.', is_read: true },
        { type: 'INFO', title: 'Delivery received from Zenith Foods', message: 'Invoice ZFL-2026-0412 accepted.', is_read: true },
      ],
    });

    res.json({ success: true, message: 'Demo data reset successfully' });
  } catch (err) {
    console.error('[Demo Reset]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;