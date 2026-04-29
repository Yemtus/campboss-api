import prisma from '../database/prisma.js';

export async function sendAlert(message, haccpCheckId = null) {
  const apiKey = process.env.TERMII_API_KEY;
  const phones = process.env.ALERT_PHONE_NUMBERS;
  const senderId = process.env.TERMII_SENDER_ID || 'CampBoss';

  const logEntry = async (channel, to, status) => {
    await prisma.smsLog.create({
      data: { channel, to, message, status },
    }).catch(() => {});
  };

  if (!apiKey || !phones) {
    console.warn('[alertMessenger] Termii not configured — alert logged to DB only');
    await logEntry('SMS', 'not-configured', 'SKIPPED');
    return;
  }

  const numbers = phones.split(',').map(n => n.trim()).filter(Boolean);
  const { default: axios } = await import('axios');

  for (const to of numbers) {
    // SMS
    try {
      await axios.post('https://v3.api.termii.com/api/sms/send', {
        to,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: apiKey,
      });
      await logEntry('SMS', to, 'DELIVERED');
      console.log(`[alertMessenger] SMS sent to ${to}`);
    } catch (err) {
      await logEntry('SMS', to, 'FAILED');
      console.error(`[alertMessenger] SMS failed to ${to}:`, err.response?.data || err.message);
    }
  }
}