import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

async function seed() {
    try {
        console.log('Starting database seeding...');

        const adminEmail = 'murshedkoli@gmail.com';
        const adminPassword = 'password';

        await prisma.user.deleteMany({ where: { role: 'admin' } });
        console.log('Old admin removed (if existed).');

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
            },
        });
        console.log(`✅ Admin created: ${adminEmail} / ${adminPassword}`);

        const accounts = [
            { name: 'Cash Hand', type: 'Cash' },
            { name: 'City Bank', type: 'Bank', bankName: 'City Bank', accountNumber: '123456789' },
            { name: 'Bkash Personal', type: 'Mobile Banking', accountNumber: '01700000000' },
        ];

        for (const acc of accounts) {
            const exists = await prisma.account.findFirst({ where: { name: acc.name } });

            if (!exists) {
                await prisma.account.create({
                    data: {
                        name: acc.name,
                        type: acc.type,
                        balance: 0,
                        bankName: acc.bankName || null,
                        accountNumber: acc.accountNumber || null,
                    },
                });
                console.log(`Account created: ${acc.name}`);
            } else {
                console.log(`Account already exists: ${acc.name}`);
            }
        }

        console.log('Seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
}

seed();
