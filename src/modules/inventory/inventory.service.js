import prisma from '../../database/prisma.js';

export async function listItems(platformId) {
  return prisma.inventoryItem.findMany({
    where: {
      is_active: true,
      ...(platformId ? { platform_id: platformId } : {}),
    },
    include: {
      batches: {
        where: { status: 'ACTIVE' },
        select: { quantity_remaining: true, expiry_date: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createItem(data, user) {
  return prisma.inventoryItem.create({
    data: {
      name: data.name,
      sku: data.sku || null,
      category: data.category || null,
      unit_of_measure: data.unit_of_measure || 'pcs',
      reorder_threshold: Number(data.reorder_threshold) || 10,
      critical_threshold: Number(data.critical_threshold) || 5,
      storage_location: data.storage_location || null,
      platform_id: user.platform_id,
      is_active: true,
    },
  });
}

export async function updateItem(id, data) {
  return prisma.inventoryItem.update({
    where: { id: Number(id) },
    data: {
      name: data.name,
      sku: data.sku,
      category: data.category,
      unit_of_measure: data.unit_of_measure,
      reorder_threshold: data.reorder_threshold ? Number(data.reorder_threshold) : undefined,
      critical_threshold: data.critical_threshold ? Number(data.critical_threshold) : undefined,
      storage_location: data.storage_location,
    },
  });
}

export async function addBatch(itemId, data, user) {
  return prisma.inventoryBatch.create({
    data: {
      item_id: Number(itemId),
      batch_number: data.batch_number || null,
      supplier: data.supplier || null,
      quantity_received: Number(data.quantity_received),
      quantity_remaining: Number(data.quantity_received),
      unit_cost: data.unit_cost ? Number(data.unit_cost) : null,
      received_date: new Date(data.received_date),
      expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
      status: 'ACTIVE',
    },
  });
}

export async function importItems(rows, user) {
  let created = 0;
  let skipped = 0;
  const errors = [];

  const alias = {
    item_name: 'name', item: 'name', product: 'name',
    uom: 'unit_of_measure', unit: 'unit_of_measure',
    reorder: 'reorder_threshold', reorder_level: 'reorder_threshold',
    critical: 'critical_threshold', minimum: 'critical_threshold',
    location: 'storage_location', store: 'storage_location',
  };

  for (const row of rows) {
    const mapped = {};
    Object.entries(row).forEach(([k, v]) => {
      const key = k.toLowerCase().replace(/\s+/g, '_');
      mapped[alias[key] || key] = v;
    });

    if (!mapped.name) continue;

    const exists = await prisma.inventoryItem.findFirst({
      where: { name: { equals: String(mapped.name), mode: 'insensitive' } },
    });

    if (exists) { skipped++; continue; }

    try {
      await prisma.inventoryItem.create({
        data: {
          name: String(mapped.name),
          sku: mapped.sku ? String(mapped.sku) : null,
          category: mapped.category ? String(mapped.category) : 'Imported',
          unit_of_measure: mapped.unit_of_measure ? String(mapped.unit_of_measure) : 'pcs',
          reorder_threshold: Number(mapped.reorder_threshold) || 10,
          critical_threshold: Number(mapped.critical_threshold) || 5,
          storage_location: mapped.storage_location ? String(mapped.storage_location) : null,
          platform_id: user.platform_id,
          is_active: true,
        },
      });
      created++;
    } catch (err) {
      errors.push(`${mapped.name}: ${err.message}`);
    }
  }

  return { created, skipped, errors };
}