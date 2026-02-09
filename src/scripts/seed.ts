import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Account from '../models/Account';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

// Hardcoded URI for script execution if modules not loaded
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bizledger';

async function seed() {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Seed Admin
        const adminEmail = 'admin@bizledger.local';
        const adminPassword = 'admin'; // Simple for internal use, change on prod

        // Check if admin exists
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await User.create({
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
            });
            console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
        } else {
            console.log('Admin already exists');
        }

        // Seed Basic Accounts
        const accounts = [
            { name: 'Cash Hand', type: 'Cash' },
            { name: 'City Bank', type: 'Bank', bankName: 'City Bank', accountNumber: '123456789' },
            { name: 'Bkash Personal', type: 'Mobile Banking', accountNumber: '01700000000' },
        ];

        for (const acc of accounts) {
            const exists = await Account.findOne({ name: acc.name });
            if (!exists) {
                await Account.create(acc);
                console.log(`Account created: ${acc.name}`);
            }
        }

        console.log('Seeding completed');
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seed();
