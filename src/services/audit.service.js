import prisma from '../database/prisma.js';

export async function logAudit({ user_id, action, table_name, record_id, old_values, new_values, req }) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: user_id || null,
        action,
        table_name: table_name || null,
        record_id: record_id || null,
        old_values: old_values || null,
        new_values: new_values || null,
        ip_address: req?.ip || null,
        user_agent: req?.headers?.['user-agent'] || null,
      },
    });
  } catch (err) {
    console.error('[Audit] Failed to log:', err.message);
  }
}