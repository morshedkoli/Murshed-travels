'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    try {
        const where: any = {};
        if (filters?.month && isValidMonth(filters.month)) where.month = filters.month;
        if (filters?.year) where.year = filters.year;
        if (filters?.businessId) {
            if (filters.businessId === 'travel') {
                where.OR = [{ businessId: 'travel' }, { businessId: null }];
            } else {
                where.businessId = filters.businessId;
            }
        }

        const records = await prisma.salary.findMany({
            where,
            include: { employee: { select: { name: true, role: true, baseSalary: true, active: true } } },
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });

        return records.map((record) => ({
            _id: record.id,
            employeeId: record.employeeId || '',
            employeeName: record.employee?.name || 'Unknown Employee',
            employeeRole: record.employee?.role || '-',
            amount: record.amount,
            month: record.month,
            year: record.year,
            status: record.status as 'unpaid' | 'paid',
            businessId: (record.businessId as SalaryBusiness) || 'travel',
            paidDate: record.paidDate ? record.paidDate.toISOString() : '',
            createdAt: record.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching salary records:', error);
        return [];
    }
}

export async function generateMonthlySalaries(input: GenerateInput) {
    try {
        const month = normalizeText(input.month);
        if (!month || !isValidMonth(month)) return { error: 'Month must be in YYYY-MM format' };

        const year = Number(input.year);
        if (!Number.isInteger(year) || year < 2000 || year > 3000) return { error: 'Year must be a valid number' };

        const businessId = input.businessId;

        let createdCount = 0;
        let updatedCount = 0;

        const employeeWhere: any = { active: true };
        if (businessId === 'travel') {
            employeeWhere.OR = [{ businessId: 'travel' }, { businessId: null }];
        } else {
            employeeWhere.businessId = businessId;
        }

        const employees = await prisma.employee.findMany({ where: employeeWhere });

        for (const employee of employees) {
            const existing = await prisma.salary.findFirst({
                where: {
                    employeeId: employee.id,
                    month,
                    year,
                    businessId
                }
            });

            if (!existing) {
                await prisma.salary.create({
                    data: {
                        employeeId: employee.id,
                        amount: employee.baseSalary,
                        month,
                        year,
                        status: 'unpaid',
                        businessId
                    }
                });
                createdCount++;
            } else if (existing.status === 'unpaid' && existing.amount !== employee.baseSalary) {
                await prisma.salary.update({
                    where: { id: existing.id },
                    data: { amount: employee.baseSalary }
                });
                updatedCount++;
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
        const accountId = normalizeText(input.accountId);
        if (!accountId) return { error: 'Account is required' };

        const paidDate = normalizePaidDate(input.paidDate);
        if (!paidDate) return { error: 'Paid date is invalid' };

        const salary = await prisma.salary.findUnique({
            where: { id: input.salaryId },
            include: { employee: { select: { name: true } } }
        });

        if (!salary) return { error: 'Salary record not found' };
        if (salary.status === 'paid') return { error: 'This salary is already paid' };

        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) return { error: 'Selected account does not exist' };
        if ((account.balance || 0) < salary.amount) return { error: 'Insufficient account balance for salary payment' };

        await prisma.$transaction(async (tx) => {
            await tx.salary.update({
                where: { id: input.salaryId },
                data: { status: 'paid', paidDate }
            });

            await tx.transaction.create({
                data: {
                    date: paidDate,
                    amount: salary.amount,
                    type: 'expense',
                    category: 'Salary',
                    businessId: salary.businessId || 'travel',
                    accountId,
                    description: `Salary payment for ${salary.employee?.name || 'employee'} (${salary.month})`,
                    referenceId: input.salaryId,
                    referenceModel: 'Salary',
                }
            });

            await tx.account.update({
                where: { id: accountId },
                data: { balance: { decrement: salary.amount } }
            });
        });

        revalidateSalaryViews();
        return { success: true };
    } catch (error) {
        console.error('Pay salary error:', error);
        return { error: 'Failed to mark salary as paid' };
    }
}
