import { PrismaClient } from '@prisma/client'

/**
 * Один экземпляр Prisma на процесс. В dev-режиме переиспользуется,
 * чтобы избежать утечек подключений при hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
