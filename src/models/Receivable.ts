import mongoose from 'mongoose';

const ReceivableSchema = new mongoose.Schema({
    businessId: {
        type: String,
        enum: ['travel', 'isp'],
        default: 'travel',
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    dueDate: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['unpaid', 'partial', 'paid'],
        default: 'unpaid',
    },
    description: {
        type: String,
    }
}, { timestamps: true });

ReceivableSchema.index({ status: 1, dueDate: 1 });
ReceivableSchema.index({ customerId: 1 });

export default mongoose.models.Receivable || mongoose.model('Receivable', ReceivableSchema);
