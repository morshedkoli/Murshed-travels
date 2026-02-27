import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        transactionOptions: {
            maxWait: 10000,   // max time to wait for a transaction slot (ms)
            timeout: 30000,   // max time the transaction itself may run (ms)
        },
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
