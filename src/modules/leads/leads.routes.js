import { Router } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

router.post('/submit', async (req, res, next) => {
  try {
    const { name, company, email, phone, camp_size } = req.body;

    if (!name || !email || !company) {
      return res.status(400).json({ success: false, message: 'Name, company and email are required' });
    }

    // Send demo credentials to prospect
    await transporter.sendMail({
      from: `"Camp Boss" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Your Camp Boss Demo Access',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:2rem;border-radius:12px;">
          <div style="margin-bottom:2rem;">
            <span style="font-size:1.3rem;font-weight:800;color:#fff;">⚓ Camp Boss</span>
          </div>
          <h1 style="font-size:1.5rem;font-weight:800;color:#fff;margin-bottom:0.5rem;">Welcome, ${name}!</h1>
          <p style="color:#94a3b8;margin-bottom:2rem;">Your demo access is ready. Here are your login credentials:</p>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:1.5rem;margin-bottom:2rem;">
            <div style="margin-bottom:1rem;">
              <p style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;">Demo URL</p>
              <a href="https://campapp-gamma.vercel.app" style="color:#f97316;font-weight:600;text-decoration:none;">campapp-gamma.vercel.app</a>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
              <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.75rem;">
                <p style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;">Username</p>
                <p style="font-family:monospace;color:#f97316;font-weight:700;font-size:1.1rem;">demo</p>
              </div>
              <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.75rem;">
                <p style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;">Password</p>
                <p style="font-family:monospace;color:#f97316;font-weight:700;font-size:1.1rem;">demo123</p>
              </div>
            </div>
          </div>
          <p style="color:#94a3b8;margin-bottom:1rem;">The demo is pre-loaded with realistic offshore catering data. Explore every feature straight away. Data resets automatically every midnight.</p>
          <p style="color:#94a3b8;margin-bottom:2rem;">Want a personalised walkthrough? Send us a WhatsApp message and we will get back to you within 24 hours.</p>
          <a href="https://wa.me/2348034765266?text=Hi,%20I%20just%20got%20my%20Camp%20Boss%20demo%20access%20and%20would%20like%20a%20walkthrough." style="display:inline-block;background:#f97316;color:#fff;padding:0.85rem 2rem;border-radius:8px;font-weight:700;text-decoration:none;margin-bottom:2rem;">Chat With Us on WhatsApp</a>
          <div style="border-top:1px solid #1e293b;padding-top:1.5rem;margin-top:1rem;">
            <p style="color:#475569;font-size:0.8rem;">Camp Boss by Mollernik Global Services - Port Harcourt, Nigeria</p>
          </div>
        </div>
      `,
    });

    // Notify you about the new lead
    await transporter.sendMail({
      from: `"Camp Boss" <${process.env.GMAIL_USER}>`,
      to: process.env.NOTIFY_EMAIL,
      subject: `New Camp Boss Lead - ${company}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:2rem;">
          <h2 style="color:#f97316;">New Demo Request</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:0.5rem 0;color:#64748b;font-size:0.875rem;">Name</td><td style="padding:0.5rem 0;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:0.5rem 0;color:#64748b;font-size:0.875rem;">Company</td><td style="padding:0.5rem 0;font-weight:600;">${company}</td></tr>
            <tr><td style="padding:0.5rem 0;color:#64748b;font-size:0.875rem;">Email</td><td style="padding:0.5rem 0;font-weight:600;">${email}</td></tr>
            <tr><td style="padding:0.5rem 0;color:#64748b;font-size:0.875rem;">Phone</td><td style="padding:0.5rem 0;font-weight:600;">${phone || 'Not provided'}</td></tr>
            <tr><td style="padding:0.5rem 0;color:#64748b;font-size:0.875rem;">Camp Size</td><td style="padding:0.5rem 0;font-weight:600;">${camp_size || 'Not provided'}</td></tr>
          </table>
          <a href="https://wa.me/${phone}" style="display:inline-block;background:#25d366;color:#fff;padding:0.75rem 1.5rem;border-radius:8px;font-weight:700;text-decoration:none;margin-top:1rem;">WhatsApp This Lead</a>
        </div>
      `,
    });

    res.json({ success: true, message: 'Demo access sent to your email' });
  } catch (err) {
    next(err);
  }
});

export default router;