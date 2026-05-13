import prisma from '../database/prisma.js';

async function wipeDemo() {
  const demo = await prisma.user.findFirst({ where: { username: 'demo' } });
  const platform = await prisma.platform.findFirst();

  if (!demo || !platform) { console.log('Not found'); return; }

  await prisma.mealRating.deleteMany({ where: { platform_id: platform.id } });
  await prisma.equipmentLog.deleteMany({});
  await prisma.equipment.deleteMany({ where: { platform_id: platform.id } });
  await prisma.supplierPayment.deleteMany({ where: { platform_id: platform.id } });
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.contract.deleteMany({ where: { platform_id: platform.id } });
  await prisma.notification.deleteMany({});
  await prisma.haccpCheck.deleteMany({ where: { checked_by_id: demo.id } });
  await prisma.inventoryBatch.deleteMany({});
  await prisma.inventoryItem.deleteMany({ where: { platform_id: platform.id } });
  await prisma.receivingCheck.deleteMany({ where: { checked_by_id: demo.id } });
  await prisma.expense.deleteMany({});
  await prisma.shift.deleteMany({ where: { platform_id: platform.id } });
  await prisma.smsLog.deleteMany({});
  await prisma.auditLog.deleteMany({ where: { user_id: demo.id } });

  console.log('Old demo data wiped successfully');
  await prisma.$disconnect();
}

wipeDemo().catch(console.error);