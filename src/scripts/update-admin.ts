import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const prisma = new PrismaClient();

async function updateAdmin() {
    const newPin = '2580';

    console.log('🔧 Connecting to DB...');

    await prisma.user.deleteMany({
        where: { role: 'admin' },
    });
    console.log('✅ Old admin user(s) deleted.');

    const hashedPin = await bcrypt.hash(newPin, 10);

    await prisma.user.create({
        data: {
            pin: hashedPin,
            role: 'admin',
        },
    });

    console.log('');
    console.log('🎉 Admin credentials updated successfully!');
    process.exit(0);
}

updateAdmin().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
