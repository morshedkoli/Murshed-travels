import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    baseSalary: {
        type: Number,
        required: true,
    },
    businessId: {
        type: String,
        enum: ['travel', 'isp'],
        default: 'travel',
        required: true,
    },
    active: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

export default mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
