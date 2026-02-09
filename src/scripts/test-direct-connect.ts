import mongoose from 'mongoose';

const directUri = process.env.MONGODB_URI;

if (!directUri) {
    console.error('MONGODB_URI is not defined');
    process.exit(1);
}

console.log('Testing direct connection string (no SRV)...');
console.log('Using MONGODB_URI from environment');

mongoose.connect(directUri)
    .then(() => {
        console.log('✅ Connected to MongoDB successfully via Direct URI!');
        return mongoose.disconnect();
    })
    .then(() => {
        console.log('Disconnected cleanly.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Direct Connection failed:', err);
        process.exit(1);
    });
