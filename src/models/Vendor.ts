import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
    },
    email: {
        type: String,
    },
    // Service categories this vendor provides
    serviceCategories: [{
        type: String,
        enum: ['visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'transport', 'package', 'other'],
    }],
    // Commission structure
    commissionType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'fixed',
    },
    commissionValue: {
        type: Number,
        default: 0,
    },
    // Primary contact person
    contactPerson: {
        name: String,
        phone: String,
        email: String,
    },
    // Bank details for payments
    bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        branch: String,
    },
    // Vendor status
    status: {
        type: String,
        enum: ['active', 'inactive', 'blacklisted'],
        default: 'active',
    },
    // Rating (1-5)
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },
    // Notes
    notes: {
        type: String,
    },
    // Financial tracking
    balance: {
        type: Number,
        default: 0,
    },
    totalServicesProvided: {
        type: Number,
        default: 0,
    },
    serviceTemplates: [{
        name: {
            type: String,
            required: true,
        },
        serviceType: {
            type: String,
            enum: ['visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'package', 'other'],
            required: true,
        },
        category: {
            type: String,
            required: true,
        },
        defaultPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        defaultCost: {
            type: Number,
            required: true,
            min: 0,
        },
    }],
}, { timestamps: true });

VendorSchema.index({ status: 1 });
VendorSchema.index({ serviceCategories: 1 });

const existingVendorModel = mongoose.models.Vendor;

if (existingVendorModel && !existingVendorModel.schema.path('serviceTemplates')) {
    existingVendorModel.schema.add({
        serviceTemplates: [{
            name: {
                type: String,
                required: true,
            },
            serviceType: {
                type: String,
                enum: ['visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'package', 'other'],
                required: true,
            },
            category: {
                type: String,
                required: true,
            },
            defaultPrice: {
                type: Number,
                required: true,
                min: 0,
            },
            defaultCost: {
                type: Number,
                required: true,
                min: 0,
            },
        }],
    });
}

export default existingVendorModel || mongoose.model('Vendor', VendorSchema);
