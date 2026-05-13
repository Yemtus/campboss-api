import prisma from '../database/prisma.js';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seedDemo() {
  console.log('Seeding demo data...');
  
  const demoUser = await prisma.user.findFirst({ where: { username: 'demo' } });
  const platform = await prisma.platform.findFirst();

  if (!demoUser || !platform) {
    console.error('Demo user or platform not found');
    return;
  }

  // ── HACCP CHECKS ──────────────────────────────────────────
  const haccpPoints = await prisma.haccpMonitoringPoint.findMany({ take: 4 });
  const haccpData = [
    { result: 'PASS', temperature: -17, corrective_action: null, daysAgo: 0 },
    { result: 'PASS', temperature: 76, corrective_action: null, daysAgo: 0 },
    { result: 'PASS', temperature: -18, corrective_action: null, daysAgo: 0 },
    { result: 'WARNING', temperature: -14, corrective_action: 'Door seal inspected and tightened.', daysAgo: 1 },
    { result: 'FAIL', temperature: -10, corrective_action: 'Compressor checked and reset. Temperature returning to range.', daysAgo: 1 },
    { result: 'PASS', temperature: 74, corrective_action: null, daysAgo: 2 },
    { result: 'PASS', temperature: -17, corrective_action: null, daysAgo: 2 },
    { result: 'FAIL', temperature: 62, corrective_action: 'Hot holding unit serviced. Food discarded per HACCP protocol.', daysAgo: 3 },
    { result: 'PASS', temperature: 75, corrective_action: null, daysAgo: 3 },
    { result: 'PASS', temperature: -16, corrective_action: null, daysAgo: 4 },
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
  console.log('HACCP checks seeded');

  // ── INVENTORY WITH STOCK QUANTITIES ───────────────────────
  const inventoryItems = [
    { name: 'Rice (50kg bags)', category: 'DRY_GOODS', reorder_threshold: 5, critical_threshold: 2, storage_location: 'Dry Store A', quantity: 24, unit: 'bags' },
    { name: 'Chicken (Frozen)', category: 'PROTEIN', reorder_threshold: 20, critical_threshold: 8, storage_location: 'Freezer #1', quantity: 80, unit: 'kg' },
    { name: 'Vegetable Oil', category: 'CONDIMENTS', reorder_threshold: 5, critical_threshold: 2, storage_location: 'Dry Store B', quantity: 15, unit: 'litres' },
    { name: 'Tomato Paste', category: 'CONDIMENTS', reorder_threshold: 10, critical_threshold: 4, storage_location: 'Dry Store A', quantity: 36, unit: 'cans' },
    { name: 'Fresh Vegetables', category: 'PRODUCE', reorder_threshold: 15, critical_threshold: 5, storage_location: 'Cold Room', quantity: 45, unit: 'kg' },
    { name: 'Beef (Frozen)', category: 'PROTEIN', reorder_threshold: 20, critical_threshold: 8, storage_location: 'Freezer #2', quantity: 3, unit: 'kg' },
    { name: 'Bread Loaves', category: 'BAKERY', reorder_threshold: 6, critical_threshold: 2, storage_location: 'Dry Store B', quantity: 12, unit: 'loaves' },
    { name: 'Eggs', category: 'PROTEIN', reorder_threshold: 60, critical_threshold: 20, storage_location: 'Cold Room', quantity: 240, unit: 'pieces' },
  ];

  for (const item of inventoryItems) {
    const created = await prisma.inventoryItem.create({
      data: {
        name: item.name,
        category: item.category,
        reorder_threshold: item.reorder_threshold,
        critical_threshold: item.critical_threshold,
        storage_location: item.storage_location,
        unit_of_measure: item.unit,
        platform_id: platform.id,
      },
    });

    // Add stock batch so quantities show correctly
    await prisma.inventoryBatch.create({
      data: {
        item_id: created.id,
        quantity_received: item.quantity,
        quantity_remaining: item.quantity,
        received_date: new Date(),
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        supplier: 'Opening Stock',
        unit_cost: 0,
      },
    });
  }
  console.log('Inventory seeded with stock quantities');

  // ── RECEIVING CHECKS ───────────────────────────────────────
  const deliveries = [
    { supplier: 'Zenith Foods Ltd', invoice_no: 'ZFL-2026-0412', items_summary: 'Frozen chicken 80kg, Beef 60kg, Fish 40kg', status: 'ACCEPTED', daysAgo: 1 },
    { supplier: 'Niger Delta Provisions', invoice_no: 'NDP-0389', items_summary: 'Rice 24 bags, Vegetable oil 15L, Tomato paste 36 cans', status: 'ACCEPTED', daysAgo: 3 },
    { supplier: 'Fresh Farm Supplies', invoice_no: 'FFS-2026-201', items_summary: 'Fresh vegetables 45kg, Fruits assorted 20kg', status: 'PARTIAL', daysAgo: 5 },
    { supplier: 'Bakery Plus Nigeria', invoice_no: 'BPN-0091', items_summary: 'Bread loaves 12, Pastries assorted', status: 'ACCEPTED', daysAgo: 7 },
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
  console.log('Receiving checks seeded');

  // ── BUDGET EXPENSES ────────────────────────────────────────
  const expenseList = [
    { category: 'FOOD', description: 'Weekly protein stock - Zenith Foods', amount: 485000, daysAgo: 1 },
    { category: 'FOOD', description: 'Dry goods - Niger Delta Provisions', amount: 320000, daysAgo: 3 },
    { category: 'FOOD', description: 'Fresh produce - Farm Supplies', amount: 95000, daysAgo: 5 },
    { category: 'CONSUMABLES', description: 'Cleaning supplies - Dettol, bleach, gloves', amount: 42000, daysAgo: 4 },
    { category: 'EQUIPMENT', description: 'Replacement food thermometer', amount: 18500, daysAgo: 6 },
    { category: 'FOOD', description: 'Bakery items', amount: 28000, daysAgo: 7 },
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
  console.log('Budget expenses seeded');

  // ── ATTENDANCE / POB - includes today so dashboard shows correctly ──
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
  console.log('Attendance seeded');

  // ── FINANCE - contract and invoice ────────────────────────
  const contract = await prisma.contract.create({
    data: {
      platform_id: platform.id,
      oil_company: 'Shell Nigeria (SPDC)',
      contract_type: 'PER_HEAD',
      currency: 'NGN',
      rate_per_head: 8500,
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-12-31'),
      status: 'ACTIVE',
      notes: 'Annual catering contract for Platform Alpha',
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      contract_id: contract.id,
      invoice_number: 'INV-2026-0001',
      period_start: new Date('2026-04-01'),
      period_end: new Date('2026-04-30'),
      total_days: 30,
      total_pob: 61,
      subtotal: 15555000,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 15555000,
      currency: 'NGN',
      status: 'PAID',
      issued_at: new Date('2026-05-01'),
      due_date: new Date('2026-05-31'),
      paid_at: new Date('2026-05-05'),
      notes: 'April 2026 catering services',
      items: {
        create: [
          {
            description: 'Catering services - 61 persons x 30 days x N8,500/head/day',
            quantity: 1830,
            unit_price: 8500,
            total: 15555000,
          },
        ],
      },
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      contract_id: contract.id,
      invoice_number: 'INV-2026-0002',
      period_start: new Date('2026-05-01'),
      period_end: new Date('2026-05-31'),
      total_days: 31,
      total_pob: 62,
      subtotal: 16337000,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 16337000,
      currency: 'NGN',
      status: 'SENT',
      issued_at: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: 'May 2026 catering services',
      items: {
        create: [
          {
            description: 'Catering services - 62 persons x 31 days x N8,500/head/day',
            quantity: 1922,
            unit_price: 8500,
            total: 16337000,
          },
        ],
      },
    },
  });

  await prisma.supplierPayment.create({
    data: {
      supplier_name: 'Zenith Foods Ltd',
      amount: 485000,
      currency: 'NGN',
      payment_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      payment_method: 'BANK_TRANSFER',
      reference: 'TRF-2026-0412',
      notes: 'Payment for weekly protein stock',
      recorded_by_id: demoUser.id,
      platform_id: platform.id,
    },
  });

  await prisma.supplierPayment.create({
    data: {
      supplier_name: 'Niger Delta Provisions',
      amount: 320000,
      currency: 'NGN',
      payment_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      payment_method: 'BANK_TRANSFER',
      reference: 'TRF-2026-0389',
      notes: 'Payment for dry goods delivery',
      recorded_by_id: demoUser.id,
      platform_id: platform.id,
    },
  });
  console.log('Finance data seeded');

  // ── EQUIPMENT ─────────────────────────────────────────────
  const equipmentList = [
    { name: 'Walk-in Freezer #1', equipment_type: 'FREEZER', model: 'Carrier 20ft', serial_number: 'CAR-2021-0041', status: 'OPERATIONAL', last_service_date: new Date('2026-03-01'), next_service_date: new Date('2026-09-01') },
    { name: 'Walk-in Freezer #2', equipment_type: 'FREEZER', model: 'Carrier 20ft', serial_number: 'CAR-2021-0042', status: 'NEEDS_SERVICE', last_service_date: new Date('2025-10-01'), next_service_date: new Date('2026-04-01') },
    { name: 'Hot Holding Bain-Marie', equipment_type: 'HOT_HOLDING', model: 'Lincat LB3', serial_number: 'LIN-2022-0015', status: 'OPERATIONAL', last_service_date: new Date('2026-02-01'), next_service_date: new Date('2026-08-01') },
    { name: 'Industrial Oven #1', equipment_type: 'OVEN', model: 'Rational SCC 61', serial_number: 'RAT-2020-0009', status: 'OPERATIONAL', last_service_date: new Date('2026-01-15'), next_service_date: new Date('2026-07-15') },
    { name: 'Cold Room', equipment_type: 'CHILLER', model: 'Hoshizaki HCR', serial_number: 'HOS-2019-0003', status: 'OPERATIONAL', last_service_date: new Date('2026-04-01'), next_service_date: new Date('2026-10-01') },
  ];

  for (const eq of equipmentList) {
    const created = await prisma.equipment.create({
      data: {
        name: eq.name,
        equipment_type: eq.equipment_type,
        model: eq.model,
        serial_number: eq.serial_number,
        status: eq.status,
        last_service_date: eq.last_service_date,
        next_service_date: eq.next_service_date,
        installation_date: new Date('2019-01-01'),
        platform_id: platform.id,
      },
    });

    // Add a log entry for each
    await prisma.equipmentLog.create({
      data: {
        equipment_id: created.id,
        log_type: eq.status === 'NEEDS_SERVICE' ? 'FAULT' : 'MAINTENANCE',
        description: eq.status === 'NEEDS_SERVICE'
          ? 'Unit flagged for overdue service. Temperature inconsistencies noted.'
          : 'Routine maintenance completed. All checks passed.',
        logged_by_id: demoUser.id,
      },
    });
  }
  console.log('Equipment seeded');

  // ── CREW RATINGS ──────────────────────────────────────────
  const ratingData = [
    { meal_type: 'BREAKFAST', rating: 5, comment: 'Excellent breakfast today, jollof rice was perfect.', daysAgo: 0 },
    { meal_type: 'LUNCH', rating: 4, comment: null, daysAgo: 0 },
    { meal_type: 'DINNER', rating: 4, comment: 'Good food but portion could be bigger.', daysAgo: 0 },
    { meal_type: 'BREAKFAST', rating: 5, comment: null, daysAgo: 1 },
    { meal_type: 'LUNCH', rating: 3, comment: 'Stew was a bit cold today.', daysAgo: 1 },
    { meal_type: 'DINNER', rating: 5, comment: 'Best pepper soup I have had offshore.', daysAgo: 1 },
    { meal_type: 'BREAKFAST', rating: 4, comment: null, daysAgo: 2 },
    { meal_type: 'LUNCH', rating: 4, comment: 'Keep it up.', daysAgo: 2 },
    { meal_type: 'DINNER', rating: 3, comment: 'Rice was overcooked.', daysAgo: 2 },
    { meal_type: 'BREAKFAST', rating: 5, comment: null, daysAgo: 3 },
    { meal_type: 'LUNCH', rating: 5, comment: 'Excellent as always.', daysAgo: 3 },
  ];

  for (const r of ratingData) {
    const date = new Date();
    date.setDate(date.getDate() - r.daysAgo);
    await prisma.mealRating.create({
      data: {
        platform_id: platform.id,
        meal_date: date,
        meal_type: r.meal_type,
        rating: r.rating,
        comment: r.comment,
        created_at: date,
      },
    });
  }
  console.log('Crew ratings seeded');

  // ── HANDOVER REPORTS ──────────────────────────────────────
  const handoverData = [
    { shift: 'DAY', summary: 'All HACCP checks completed. Walk-in Freezer #2 flagged for service - temperature inconsistent. Delivery from Zenith Foods received and signed off. 62 crew on board.', daysAgo: 0 },
    { shift: 'NIGHT', summary: 'Quiet shift. All temperature checks passed. Prep for tomorrow breakfast completed. No incidents to report. 62 crew on board.', daysAgo: 1 },
    { shift: 'DAY', summary: 'Hot holding unit serviced by technician. HACCP fail logged and corrective action taken. Delivery from Niger Delta Provisions received. 58 crew on board.', daysAgo: 2 },
    { shift: 'NIGHT', summary: 'All checks passed. Menu prep for next day completed. Gas cylinder replaced - utilities expense logged.', daysAgo: 3 },
  ];

  for (const h of handoverData) {
    const date = new Date();
    date.setDate(date.getDate() - h.daysAgo);
    await prisma.handoverReport.create({
      data: {
        shift: h.shift,
        date: date,
        summary: h.summary,
        status: 'signed',
        author_id: demoUser.id,
        platform_id: platform.id,
        signed_by_id: demoUser.id,
        signed_at: date,
      },
    });
  }
  console.log('Handover reports seeded');

  // ── INSPECTIONS ───────────────────────────────────────────
  const inspectionData = [
    { title: 'Weekly Kitchen Inspection', type: 'INTERNAL', score: 88, notes: 'Good overall cleanliness. Minor issues with storage labelling corrected on the spot.', daysAgo: 2 },
    { title: 'HACCP Audit Inspection', type: 'HACCP_AUDIT', score: 92, notes: 'All critical control points within acceptable range. Documentation up to date.', daysAgo: 9 },
    { title: 'Weekly Kitchen Inspection', type: 'INTERNAL', score: 85, notes: 'Cold room temperature log incomplete for two days. Corrected and staff reminded.', daysAgo: 16 },
    { title: 'IOC Compliance Check', type: 'IOC_AUDIT', score: 90, notes: 'Full compliance with Shell STOP card requirements. No major findings.', daysAgo: 23 },
  ];

  for (const insp of inspectionData) {
    const date = new Date();
    date.setDate(date.getDate() - insp.daysAgo);
    await prisma.inspection.create({
      data: {
        title: insp.title,
        type: insp.type,
        score: insp.score,
        notes: insp.notes,
        status: 'COMPLETED',
        inspector_id: demoUser.id,
        platform_id: platform.id,
        conducted_at: date,
      },
    });
  }
  console.log('Inspections seeded');

  // ── NOTIFICATIONS ─────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { type: 'ALERT', title: 'HACCP FAIL - Walk-in Freezer #1', message: 'Temperature -10C outside range. Corrective action logged.', is_read: false },
      { type: 'ALERT', title: 'HACCP FAIL - Hot Holding Unit', message: 'Temperature 62C below minimum. Food discarded per protocol.', is_read: true },
      { type: 'INFO', title: 'Delivery received from Zenith Foods', message: 'Invoice ZFL-2026-0412 accepted and signed off.', is_read: true },
      { type: 'ALERT', title: 'Equipment Alert - Walk-in Freezer #2', message: 'Unit overdue for service. Last serviced October 2025.', is_read: false },
      { type: 'INFO', title: 'Invoice INV-2026-0001 paid', message: 'Shell Nigeria payment of N15,555,000 confirmed.', is_read: true },
    ],
  });
  console.log('Notifications seeded');

  console.log('✅ Demo data seeding complete!');
}

seedDemo().catch(console.error).finally(() => prisma.$disconnect());