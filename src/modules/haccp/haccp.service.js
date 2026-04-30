import prisma from '../../database/prisma.js';
import { sendAlert } from '../../services/alertMessenger.js';
import { logAudit } from '../../services/audit.service.js';

export async function listPoints(platformId) {
  return prisma.haccpMonitoringPoint.findMany({
    where: {
      is_active: true,
      ...(platformId ? { platform_id: platformId } : {}),
    },
    orderBy: { name: 'asc' },
  });
}

export async function listChecks(platformId) {
  return prisma.haccpCheck.findMany({
    where: platformId ? { platform_id: platformId } : {},
    orderBy: { checked_at: 'desc' },
    take: 100,
    include: {
      point: true,
      checked_by: { select: { id: true, full_name: true } },
      signed_by: { select: { id: true, full_name: true } },
    },
  });
}

export async function createCheck({ point_id, temperature, corrective_action }, user) {
  const point = await prisma.haccpMonitoringPoint.findUnique({ where: { id: Number(point_id) } });
  if (!point) throw new Error('Monitoring point not found');

  const temp = Number(temperature);
  let result = 'PASS';

  if (point.check_type === 'TEMPERATURE') {
    const min = Number(point.min_temp);
    const max = Number(point.max_temp);
    if (temp < min || temp > max) result = 'FAIL';
    else if (temp < min + 2 || temp > max - 2) result = 'WARNING';
  }

  const check = await prisma.haccpCheck.create({
    data: {
      point_id: Number(point_id),
      temperature: temp,
      result,
      corrective_action: corrective_action || null,
      checked_by_id: user.id,
      platform_id: user.platform_id,
    },
    include: {
      point: true,
      checked_by: { select: { id: true, full_name: true } },
    },
  });

  if (result === 'FAIL') {
    const message = [
      `CAMP BOSS ALERT [${new Date().toLocaleString()}]`,
      `HACCP FAILURE at ${point.name}`,
      `Temperature: ${temp}°C (range: ${point.min_temp}–${point.max_temp}°C)`,
      `Checked by: ${user.full_name}`,
      `Corrective action: ${corrective_action || 'None logged'}`,
      `Action required immediately.`,
    ].join('\n');

    await sendAlert(message, check.id);

    await prisma.notification.create({
      data: {
        type: 'ALERT',
        title: `HACCP FAIL — ${point.name}`,
        message: `Temperature ${temp}°C outside range. ${corrective_action || 'No corrective action logged.'}`,
      },
    });

    await logAudit({
      user_id: user.id,
      action: 'HACCP_CHECK',
      table_name: 'haccp_checks',
      record_id: check.id,
      new_values: { temperature: temp, result, point: point.name },
      req: null,
    });
  }

  return check;
}

export async function signCheck(id, user) {
  const check = await prisma.haccpCheck.findUnique({ where: { id: Number(id) } });
  if (!check) throw new Error('Check not found');
  if (check.signed_by_id) throw new Error('Already signed off');

  return prisma.haccpCheck.update({
    where: { id: Number(id) },
    data: {
      signed_by_id: user.id,
      signed_at: new Date(),
      sign_device: user.agent || 'Web',
    },
    include: {
      point: true,
      checked_by: { select: { id: true, full_name: true } },
      signed_by: { select: { id: true, full_name: true } },
    },
  });
}