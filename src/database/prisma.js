import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:DfjoTQRvdvzRsGfJqjjmTAeVNVLZtzRw@shuttle.proxy.rlwy.net:52479/railway';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

export default prisma;