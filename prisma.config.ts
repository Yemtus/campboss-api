import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const connectionString = 'postgresql://postgres:campboss123@localhost:5432/campboss'
      return new PrismaPg({ connectionString })
    }
  }
})