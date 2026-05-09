import prisma from '../database/prisma.js';
import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash('demo123', 12);
await prisma.user.create({
  data: {
    username: 'demo',
    password_hash: hash,
    full_name: 'Demo User',
    role: 'CAMP_BOSS',
    platform_id: 1,
    is_active: true,
  },
});
console.log('Demo user created');
await prisma.$disconnect();