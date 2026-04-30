import axios from 'axios';
import prisma from './database/prisma.js';

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'Camp Boss';
const TERMII_BASE_URL = 'https://v3.api.termii.com/api';

export async function sendSMS(to, message) {
  try {
    const response = await axios.post(`${TERMII_BASE_URL}/sms/send`, {
      to,
      from: TERMII_SENDER_ID,
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: TERMII_API_KEY,
    });

    // Log to database
    await prisma.smsLog.create({
      data: {
        recipient: to,
        message,
        status: 'SENT',
        provider_response: JSON.stringify(response.data),
      },
    });

    return { success: true };
  } catch (err) {
    // Log failed attempt
    await prisma.smsLog.create({
      data: {
        recipient: to,
        message,
        status: 'FAILED',
        provider_response: err.message,
      },
    });
    return { success: false, error: err.message };
  }
}

export async function sendHACCPAlert(checkData) {
  const { point_name, temperature, limit_min, limit_max, platform_name, checked_by } = checkData;
  const message = `⚠️ HACCP ALERT - ${platform_name}: ${point_name} temperature is ${temperature}°C (limit: ${limit_min}-${limit_max}°C). Checked by ${checked_by}. Immediate action required.`;

  // Get all managers/admins phone numbers
  const managers = await prisma.user.findMany({
    where: {
      role: { in: ['SUPER_ADMIN', 'PLATFORM_MANAGER'] },
      is_active: true,
      phone: { not: null },
    },
    select: { phone: true },
  });

  const results = await Promise.all(
    managers.map(m => sendSMS(m.phone, message))
  );

  return results;
}