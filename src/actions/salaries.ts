'use server';

import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Account from '@/models/Account';
import Employee from '@/models/Employee';
import Salary from '@/models/Salary';
import Transaction from '@/models/Transaction';

type SalaryBusiness = 'travel' | 'isp';

type GenerateInput = {
    month: string;
    year: number;
    businessId: SalaryBusiness;
};

type PaySalaryInput = {
    salaryId: string;
    accountId: string;
    paidDate?: string;
};

function normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function normalizePaidDate(value?: string) {
    if (!value) return new Date();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function isValidMonth(value: string) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function revalidateSalaryViews() {
    revalidatePath('/salary');
    revalidatePath('/employees');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
}

export async function getSalaryRecords(filters?: { month?: string; year?: number; businessId?: SalaryBusiness }) {
    await connect();

    const query: Record<string, unknown> = {};

    if (filters?.month && isValidMonth(filters.month)) query.month = filters.month;
    if (filters?.year) query.year = filters.year;
    if (filters?.businessId === 'travel') {
        query.$or = [{ businessId: 'travel' }, { businessId: { $exists: false } }, { businessId: null }];
    } else if (filters?.businessId === 'isp') {
        query.businessId = 'isp';
    }

    const records = await Salary.find(query)
        .sort({ year: -1, month: -1, createdAt: -1 })
        .populate('employeeId', 'name role baseSalary active');

    return records.map((record) => ({
        _id: record._id.toString(),
        employeeId: record.employeeId?._id?.toString?.() ?? '',
        employeeName: record.employeeId?.name ?? 'Unknown Employee',
        employeeRole: record.employeeId?.role ?? '-',
        amount: record.amount,
        month: record.month,
        year: record.year,
        status: record.status as 'unpaid' | 'paid',
        businessId: (record.businessId as SalaryBusiness) ?? 'travel',
        paidDate: record.paidDate ? record.paidDate.toISOString() : '',
        createdAt: record.createdAt.toISOString(),
    }));
}

export async function generateMonthlySalaries(input: GenerateInput) {
    try {
        await connect();

        const month = normalizeText(input.month);
        if (!month || !isValidMonth(month)) {
            return { error: 'Month must be in YYYY-MM format' };
        }

        const year = Number(input.year);
        if (!Number.isInteger(year) || year < 2000 || year > 3000) {
            return { error: 'Year must be a valid number' };
        }

        const businessId = input.businessId;

        let createdCount = 0;
        let updatedCount = 0;

        const employeeQuery = businessId === 'travel'
            ? { active: true, $or: [{ businessId: 'travel' }, { businessId: { $exists: false } }, { businessId: null }] }
            : { active: true, businessId: 'isp' };

        const employees = await Employee.find(employeeQuery);

        for (const employee of employees) {
            const existing = await Salary.findOne({
                employeeId: employee._id,
                month,
                year,
                businessId,
            });

            if (!existing) {
                await Salary.create({
                    employeeId: employee._id,
                    amount: employee.baseSalary,
                    month,
                    year,
                    status: 'unpaid',
                    businessId,
                });
                createdCount += 1;
                continue;
            }

            if (existing.status === 'unpaid' && existing.amount !== employee.baseSalary) {
                existing.amount = employee.baseSalary;
                await existing.save();
                updatedCount += 1;
            }
        }

        revalidateSalaryViews();
        return { success: true, createdCount, updatedCount };
    } catch (error) {
        console.error('Generate salaries error:', error);
        return { error: 'Failed to generate monthly salaries' };
    }
}

export async function paySalary(input: PaySalaryInput) {
    try {
        await connect();

        const accountId = normalizeText(input.accountId);
        if (!accountId) return { error: 'Account is required' };

        const paidDate = normalizePaidDate(input.paidDate);
        if (!paidDate) return { error: 'Paid date is invalid' };

        const salary = await Salary.findById(input.salaryId);
        if (!salary) {
            return { error: 'Salary record not found' };
        }

        if (salary.status === 'paid') {
            return { error: 'This salary is already paid' };
        }

        const account = await Account.findById(accountId);
        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        if ((account.balance ?? 0) < salary.amount) {
            return { error: 'Insufficient account balance for salary payment' };
        }

        const employee = await Employee.findById(salary.employeeId);

        // Update salary status
        salary.status = 'paid';
        salary.paidDate = paidDate;
        await salary.save();

        // Create expense transaction
        await Transaction.create({
            date: paidDate,
            amount: salary.amount,
            type: 'expense',
            category: 'Salary',
            businessId: salary.businessId ?? 'travel',
            accountId,
            description: `Salary payment for ${employee?.name ?? 'employee'} (${salary.month})`,
            referenceId: salary._id,
            referenceModel: 'Salary',
        });

        // Update account balance
        await Account.findByIdAndUpdate(accountId, { $inc: { balance: -salary.amount } });

        revalidateSalaryViews();
        return { success: true };
    } catch (error) {
        console.error('Pay salary error:', error);
        return { error: 'Failed to mark salary as paid' };
    }
}
