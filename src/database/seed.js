import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Platforms
  const alpha = await prisma.platform.upsert({
    where: { name: 'Platform Alpha' },
    update: {},
    create: { name: 'Platform Alpha', code: 'ALPHA', location: 'OML 130, Nigeria', is_active: true },
  });

  const bonga = await prisma.platform.upsert({
    where: { name: 'FPSO Bonga' },
    update: {},
    create: { name: 'FPSO Bonga', code: 'BONGA', location: 'OML 118, Nigeria', is_active: true },
  });

  const delta = await prisma.platform.upsert({
    where: { name: 'Platform Delta' },
    update: {},
    create: { name: 'Platform Delta', code: 'DELTA', location: 'OML 58, Nigeria', is_active: true },
  });

  console.log('Platforms created');

  // Users
  const adminHash = await bcrypt.hash('admin123', 12);
  const bossHash = await bcrypt.hash('boss123', 12);
  const supHash = await bcrypt.hash('sup123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: adminHash,
      full_name: 'System Administrator',
      role: 'SUPER_ADMIN',
      platform_id: null,
      is_active: true,
    },
  });

  const boss = await prisma.user.upsert({
    where: { username: 'boss' },
    update: {},
    create: {
      username: 'boss',
      password_hash: bossHash,
      full_name: 'Titus Mollernik',
      role: 'CAMP_BOSS',
      platform_id: alpha.id,
      is_active: true,
    },
  });

  const sup1 = await prisma.user.upsert({
    where: { username: 'sup1' },
    update: {},
    create: {
      username: 'sup1',
      password_hash: supHash,
      full_name: 'Ada Okafor',
      role: 'SUPERVISOR',
      platform_id: alpha.id,
      is_active: true,
    },
  });

  console.log('Users created');

  // HACCP Monitoring Points
  const points = [
    { name: 'Walk-in Freezer #1', check_type: 'TEMPERATURE', min_temp: -18, max_temp: -15, platform_id: alpha.id },
    { name: 'Chiller Unit #1', check_type: 'TEMPERATURE', min_temp: 2, max_temp: 5, platform_id: alpha.id },
    { name: 'Hot Holding Bain-Marie', check_type: 'TEMPERATURE', min_temp: 63, max_temp: 80, platform_id: alpha.id },
    { name: 'Cooking Core Temp', check_type: 'TEMPERATURE', min_temp: 75, max_temp: 100, platform_id: alpha.id },
  ];

  for (const point of points) {
    await prisma.haccpMonitoringPoint.upsert({
      where: { id: points.indexOf(point) + 1 },
      update: {},
      create: point,
    });
  }

  console.log('HACCP points created');

  // Inventory Items
  const items = [
    { name: 'Rice (Long Grain)', sku: 'RCE-001', category: 'Dry Goods', unit_of_measure: 'kg', reorder_threshold: 50, critical_threshold: 20, storage_location: 'Dry Store A', platform_id: alpha.id },
    { name: 'Chicken (Frozen)', sku: 'CHK-001', category: 'Protein', unit_of_measure: 'kg', reorder_threshold: 30, critical_threshold: 10, storage_location: 'Freezer #1', platform_id: alpha.id },
    { name: 'Tomatoes (Fresh)', sku: 'TMT-001', category: 'Vegetables', unit_of_measure: 'kg', reorder_threshold: 15, critical_threshold: 5, storage_location: 'Chiller #1', platform_id: alpha.id },
    { name: 'Cooking Oil', sku: 'OIL-001', category: 'Oils & Fats', unit_of_measure: 'litre', reorder_threshold: 20, critical_threshold: 8, storage_location: 'Dry Store B', platform_id: alpha.id },
    { name: 'Bread (Sliced)', sku: 'BRD-001', category: 'Bakery', unit_of_measure: 'loaf', reorder_threshold: 10, critical_threshold: 3, storage_location: 'Bakery Shelf', platform_id: alpha.id },
  ];

  for (const item of items) {
    const created = await prisma.inventoryItem.create({ data: item });
    await prisma.inventoryBatch.create({
      data: {
        item_id: created.id,
        batch_number: `B2024-00${items.indexOf(item) + 1}`,
        supplier: 'Lagos Food Supplies',
        quantity_received: 100,
        quantity_remaining: 75,
        unit_cost: 500,
        received_date: new Date('2024-04-15'),
        expiry_date: new Date('2025-04-15'),
        status: 'ACTIVE',
      },
    });
  }

  console.log('Inventory created');

  // Cleaning Tasks
  const tasks = [
    { name: 'Deep clean walk-in freezer', area: 'Cold Storage', frequency: 'weekly', assigned_to: 'Kitchen Staff', platform_id: alpha.id },
    { name: 'Sanitise food prep surfaces', area: 'Main Kitchen', frequency: 'daily', assigned_to: 'All Staff', platform_id: alpha.id },
    { name: 'Clean exhaust hoods', area: 'Main Kitchen', frequency: 'weekly', assigned_to: 'Kitchen Staff', platform_id: alpha.id },
    { name: 'Mop galley floor', area: 'Galley', frequency: 'daily', assigned_to: 'Galley Staff', platform_id: alpha.id },
  ];

  for (const task of tasks) {
    await prisma.cleaningTask.create({ data: task });
  }

  console.log('Cleaning tasks created');

  // System Settings
  const settings = [
    { key: 'company_name', value: 'Camp Boss' },
    { key: 'platform_name', value: 'Offshore Platform Alpha' },
    { key: 'company_logo_url', value: '' },
    { key: 'report_footer', value: 'Camp Boss — Offshore Camp Management System | Confidential' },
    { key: 'alert_phones', value: '' },
    { key: 'primary_color', value: '#2563EB' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('Settings created');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });