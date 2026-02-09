import mongoose from 'mongoose';

const SalarySchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    month: {
        type: String,
        required: true,
    },
    year: {
        type: Number,
        required: true,
    },
    businessId: {
        type: String,
        enum: ['travel', 'isp'],
        default: 'travel',
        required: true,
    },
    status: {
        type: String,
        enum: ['unpaid', 'paid'],
        default: 'unpaid',
    },
    paidDate: {
        type: Date,
    },
}, { timestamps: true });

export default mongoose.models.Salary || mongoose.model('Salary', SalarySchema);
