import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');

console.log('Reading .env.local from:', envPath);

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = envContent.split('\n').reduce((acc, line) => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, string>);

    const uri = envVars.MONGODB_URI;

    if (!uri) {
        console.error('MONGODB_URI not found in .env.local');
        process.exit(1);
    }

    console.log('Attempting to connect to MongoDB...');

    // Set a timeout to avoid hanging
    setTimeout(() => {
        console.error('Connection timed out after 30s');
        process.exit(1);
    }, 30000);

    mongoose.connect(uri)
        .then(() => {
            console.log('✅ Connected to MongoDB successfully!');
            return mongoose.disconnect();
        })
        .then(() => {
            console.log('Disconnected cleanly.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Connection failed:', err);
            process.exit(1);
        });

} catch (error) {
    console.error('Error reading .env.local:', error);
    process.exit(1);
}
