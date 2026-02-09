import mongoose from 'mongoose';

const PayableSchema = new mongoose.Schema({
    businessId: {
        type: String,
        enum: ['travel', 'isp'],
        default: 'travel',
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
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

PayableSchema.index({ status: 1, dueDate: 1 });
PayableSchema.index({ vendorId: 1 });

export default mongoose.models.Payable || mongoose.model('Payable', PayableSchema);
