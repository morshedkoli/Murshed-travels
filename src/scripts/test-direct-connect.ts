import mongoose from 'mongoose';

// Derived from nslookup results and .env.local
const directUri = 'mongodb://travels:travels@ac-yixaxxa-shard-00-00.f39myhh.mongodb.net:27017,ac-yixaxxa-shard-00-01.f39myhh.mongodb.net:27017,ac-yixaxxa-shard-00-02.f39myhh.mongodb.net:27017/?ssl=true&authSource=admin&retryWrites=true&w=majority';

console.log('Testing direct connection string (no SRV)...');
console.log('URI:', directUri.replace('travels:travels', '*****:*****'));

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
