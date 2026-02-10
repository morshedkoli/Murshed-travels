import bcrypt from 'bcryptjs';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function seed() {
    try {
        const { supabase } = await import('../lib/supabase');
        console.log('Starting database seeding...');

        // Seed Admin
        const adminEmail = 'admin@bizledger.local';
        const adminPassword = 'admin'; // Simple for internal use, change on prod

        // Check if admin exists
        const { data: existingAdmin } = await supabase
            .from('users')
            .select('id')
            .eq('email', adminEmail)
            .single();

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            const { error } = await supabase
                .from('users')
                .insert({
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin',
                });

            if (error) {
                console.error('Error creating admin:', error);
            } else {
                console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
            }
        } else {
            console.log('Admin already exists');
        }

        // Seed Basic Accounts
        const accounts = [
            { name: 'Cash Hand', type: 'Cash' as const },
            { name: 'City Bank', type: 'Bank' as const, bank_name: 'City Bank', account_number: '123456789' },
            { name: 'Bkash Personal', type: 'Mobile Banking' as const, account_number: '01700000000' },
        ];

        for (const acc of accounts) {
            const { data: exists } = await supabase
                .from('accounts')
                .select('id')
                .eq('name', acc.name)
                .single();

            if (!exists) {
                const { error } = await supabase
                    .from('accounts')
                    .insert({
                        name: acc.name,
                        type: acc.type,
                        balance: 0,
                        bank_name: acc.bank_name || null,
                        account_number: acc.account_number || null,
                    });

                if (error) {
                    console.error(`Error creating account ${acc.name}:`, error);
                } else {
                    console.log(`Account created: ${acc.name}`);
                }
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
