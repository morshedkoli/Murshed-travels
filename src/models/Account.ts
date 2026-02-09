import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['Cash', 'Bank', 'Mobile Banking'],
        required: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    accountNumber: {
        type: String,
    },
    bankName: { // Only for Bank
        type: String,
    },
}, { timestamps: true });

export default mongoose.models.Account || mongoose.model('Account', AccountSchema);
