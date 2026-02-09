import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    category: {
        type: String,
        required: true,
    },
    // What you charge the customer
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    // What the vendor charges you (cost)
    cost: {
        type: Number,
        required: true,
        min: 0,
    },
    // Your profit = price - cost
    profit: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'ready', 'delivered', 'cancelled'],
        default: 'pending',
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
    },
    // REQUIRED: The vendor who provides this service
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
    },
    deliveryDate: {
        type: Date,
    },
    // Expense recorded for vendor payment
    expenseRecorded: {
        type: Boolean,
        default: false,
    },
    expenseTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
    },
    receivableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Receivable',
    },
    payableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payable',
    },
    // Service type for your business
    serviceType: {
        type: String,
        enum: ['visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'package', 'other'],
        required: true,
    },
    
    // VISA SPECIFIC FIELDS
    visaDetails: {
        visaType: {
            type: String,
            enum: ['tourist', 'business', 'work', 'student', 'hajj', 'umrah', 'transit'],
        },
        country: String,
        applicationDate: Date,
        submissionDate: Date,
        approvalDate: Date,
        visaNumber: String,
        expiryDate: Date,
        entryType: {
            type: String,
            enum: ['single', 'multiple'],
        },
        duration: String, // e.g., "30 days", "90 days"
    },
    
    // AIR TICKET SPECIFIC FIELDS
    ticketDetails: {
        airline: String,
        flightNumber: String,
        routeFrom: String,
        routeTo: String,
        departureDate: Date,
        arrivalDate: Date,
        flightClass: {
            type: String,
            enum: ['economy', 'business', 'first'],
        },
        pnr: String,
        ticketNumber: String,
        baggageAllowance: String,
        isRoundTrip: {
            type: Boolean,
            default: false,
        },
    },
    
    // MEDICAL CHECKUP SPECIFIC FIELDS
    medicalDetails: {
        medicalCenter: String,
        appointmentDate: Date,
        reportDate: Date,
        testResults: {
            type: String,
            enum: ['pass', 'fail', 'pending'],
        },
        certificateNumber: String,
        expiryDate: Date,
    },
    
    // TAQAMUL EXAM SPECIFIC FIELDS
    taqamulDetails: {
        examCenter: String,
        examDate: Date,
        registrationNumber: String,
        resultStatus: {
            type: String,
            enum: ['registered', 'passed', 'failed', 'pending'],
        },
        certificateNumber: String,
        score: Number,
    },
    
    // Passenger/Applicant Details (can be different from customer)
    passengerDetails: [{
        name: String,
        passportNumber: String,
        dateOfBirth: Date,
        nationality: String,
    }],
    
    // Documents
    documents: [{
        type: String, // 'passport_copy', 'visa_copy', 'ticket', 'medical_report', 'certificate'
        url: String,
        uploadedAt: Date,
    }],
    
    // Status history log
    statusHistory: [{
        status: String,
        date: Date,
        notes: String,
    }],
    
}, { timestamps: true });

ServiceSchema.index({ status: 1 });
ServiceSchema.index({ customerId: 1 });
ServiceSchema.index({ vendorId: 1 });
ServiceSchema.index({ serviceType: 1 });
ServiceSchema.index({ 'visaDetails.visaNumber': 1 });
ServiceSchema.index({ 'ticketDetails.pnr': 1 });

const existingServiceModel = mongoose.models.Service;

if (existingServiceModel && !existingServiceModel.schema.path('receivableId')) {
    existingServiceModel.schema.add({
        receivableId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Receivable',
        },
    });
}

if (existingServiceModel && !existingServiceModel.schema.path('payableId')) {
    existingServiceModel.schema.add({
        payableId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payable',
        },
    });
}

export default existingServiceModel || mongoose.model('Service', ServiceSchema);
