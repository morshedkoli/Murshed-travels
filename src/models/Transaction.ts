import mongoose from 'mongoose';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TRANSACTION_MODEL_NAME = 'Transaction';

const TransactionSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    amount: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        enum: ['income', 'expense'],
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    businessId: {
        type: String,
        enum: ['travel', 'isp'],
        default: 'travel',
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true,
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
    },
    description: {
        type: String,
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    referenceModel: {
        type: String,
    }
}, { timestamps: true });

TransactionSchema.index({ date: -1 });

function getTransactionModel(): mongoose.Model<any> {
    const existingTransactionModel = mongoose.models[TRANSACTION_MODEL_NAME] as mongoose.Model<any> | undefined;

    if (!existingTransactionModel) {
        return mongoose.model(TRANSACTION_MODEL_NAME, TransactionSchema);
    }

    const hasCustomer = Boolean(existingTransactionModel.schema.path('customerId'));
    const hasVendor = Boolean(existingTransactionModel.schema.path('vendorId'));
    const hasBusiness = Boolean(existingTransactionModel.schema.path('businessId'));
    const accountRef = existingTransactionModel.schema.path('accountId')?.options?.ref;
    const customerRef = existingTransactionModel.schema.path('customerId')?.options?.ref;
    const vendorRef = existingTransactionModel.schema.path('vendorId')?.options?.ref;

    const needsSchemaRefresh =
        !hasCustomer ||
        !hasVendor ||
        !hasBusiness ||
        accountRef !== 'Account' ||
        customerRef !== 'Customer' ||
        vendorRef !== 'Vendor';

    if (needsSchemaRefresh) {
        mongoose.deleteModel(TRANSACTION_MODEL_NAME);
        return mongoose.model(TRANSACTION_MODEL_NAME, TransactionSchema);
    }

    return existingTransactionModel;
}

export default getTransactionModel();
