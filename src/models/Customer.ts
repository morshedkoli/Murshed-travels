import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
    },
    address: {
        type: String,
    },
    balance: {
        type: Number,
        default: 0,
    },
    // Travel-specific fields
    passportNumber: {
        type: String,
    },
    nationality: {
        type: String,
    },
    dateOfBirth: {
        type: Date,
    },
    frequentFlyerNumber: {
        type: String,
    },
    // Emergency contact for travelers
    emergencyContact: {
        name: String,
        phone: String,
        relation: String,
    },
    // Total services availed by this customer
    totalServices: {
        type: Number,
        default: 0,
    },
    // Customer notes
    notes: {
        type: String,
    },
}, { timestamps: true });

CustomerSchema.index({ passportNumber: 1 });
CustomerSchema.index({ name: 'text' });

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
