'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

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
    let query = supabase
        .from('salaries')
        .select(`
            *,
            employees:employee_id (name, role, base_salary, active)
        `);

    if (filters?.month && isValidMonth(filters.month)) {
        query = query.eq('month', filters.month);
    }
    
    if (filters?.year) {
        query = query.eq('year', filters.year);
    }

    if (filters?.businessId) {
        if (filters.businessId === 'travel') {
            query = query.or('business_id.eq.travel,business_id.is.null');
        } else {
            query = query.eq('business_id', filters.businessId);
        }
    }

    const { data: records, error } = await query
        .order('year', { ascending: false })
        .order('month', { ascending: false });

    if (error) {
        console.error('Error fetching salary records:', error);
        return [];
    }

    return (records || []).map((record) => ({
        _id: record.id,
        employeeId: record.employee_id || '',
        employeeName: record.employees?.name || 'Unknown Employee',
        employeeRole: record.employees?.role || '-',
        amount: record.amount,
        month: record.month,
        year: record.year,
        status: record.status as 'unpaid' | 'paid',
        businessId: (record.business_id as SalaryBusiness) || 'travel',
        paidDate: record.paid_date || '',
        createdAt: record.created_at,
    }));
}

export async function generateMonthlySalaries(input: GenerateInput) {
    try {
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

        // Fetch active employees
        let employeeQuery = supabase
            .from('employees')
            .select('*')
            .eq('active', true);

        if (businessId === 'travel') {
            employeeQuery = employeeQuery.or('business_id.eq.travel,business_id.is.null');
        } else {
            employeeQuery = employeeQuery.eq('business_id', businessId);
        }

        const { data: employees } = await employeeQuery;

        for (const employee of (employees || [])) {
            // Check if salary record exists
            const { data: existing } = await supabase
                .from('salaries')
                .select('*')
                .eq('employee_id', employee.id)
                .eq('month', month)
                .eq('year', year)
                .eq('business_id', businessId)
                .single();

            if (!existing) {
                // Create new salary record
                await supabase
                    .from('salaries')
                    .insert({
                        employee_id: employee.id,
                        amount: employee.base_salary,
                        month,
                        year,
                        status: 'unpaid',
                        business_id: businessId,
                    });
                createdCount += 1;
            } else if (existing.status === 'unpaid' && existing.amount !== employee.base_salary) {
                // Update unpaid record with new salary
                await supabase
                    .from('salaries')
                    .update({ amount: employee.base_salary })
                    .eq('id', existing.id);
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
        const accountId = normalizeText(input.accountId);
        if (!accountId) return { error: 'Account is required' };

        const paidDate = normalizePaidDate(input.paidDate);
        if (!paidDate) return { error: 'Paid date is invalid' };

        // Fetch salary record
        const { data: salary } = await supabase
            .from('salaries')
            .select(`
                *,
                employees:employee_id (name)
            `)
            .eq('id', input.salaryId)
            .single();

        if (!salary) {
            return { error: 'Salary record not found' };
        }

        if (salary.status === 'paid') {
            return { error: 'This salary is already paid' };
        }

        // Verify account exists and has sufficient balance
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        if ((account.balance || 0) < salary.amount) {
            return { error: 'Insufficient account balance for salary payment' };
        }

        // Update salary status
        await supabase
            .from('salaries')
            .update({
                status: 'paid',
                paid_date: paidDate.toISOString(),
            })
            .eq('id', input.salaryId);

        // Create expense transaction
        await supabase
            .from('transactions')
            .insert({
                date: paidDate.toISOString(),
                amount: salary.amount,
                type: 'expense',
                category: 'Salary',
                business_id: salary.business_id || 'travel',
                account_id: accountId,
                description: `Salary payment for ${salary.employees?.name || 'employee'} (${salary.month})`,
                reference_id: input.salaryId,
                reference_model: 'Salary',
            });

        // Update account balance
        await supabase
            .from('accounts')
            .update({ balance: account.balance - salary.amount })
            .eq('id', accountId);

        revalidateSalaryViews();
        return { success: true };
    } catch (error) {
        console.error('Pay salary error:', error);
        return { error: 'Failed to mark salary as paid' };
    }
}
