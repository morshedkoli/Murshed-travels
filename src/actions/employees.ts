'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

type BusinessType = 'travel' | 'isp';

type EmployeeInput = {
    name: string;
    role: string;
    phone: string;
    baseSalary: number;
    businessId: BusinessType;
    active?: boolean;
};

function isValidBusiness(value: string): value is BusinessType {
    return value === 'travel' || value === 'isp';
}

function normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function parsePositiveAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number(value);
}

function revalidateEmployeeViews() {
    revalidatePath('/employees');
    revalidatePath('/dashboard');
}

export async function getEmployees() {
    const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching employees:', error);
        return [];
    }

    return (employees || []).map((employee) => ({
        _id: employee.id,
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        baseSalary: employee.base_salary,
        active: employee.active,
        businessId: (employee.business_id as BusinessType) || 'travel',
        createdAt: employee.created_at,
    }));
}

export async function createEmployee(data: EmployeeInput) {
    try {
        const name = normalizeText(data.name);
        if (!name) return { error: 'Employee name is required' };

        const role = normalizeText(data.role);
        if (!role) return { error: 'Role is required' };

        const phone = normalizeText(data.phone);
        if (!phone) return { error: 'Phone is required' };

        const baseSalary = parsePositiveAmount(data.baseSalary);
        if (!baseSalary) return { error: 'Base salary must be greater than 0' };

        if (!isValidBusiness(data.businessId)) {
            return { error: 'Business must be travel or isp' };
        }

        const { error } = await supabase
            .from('employees')
            .insert({
                name,
                role,
                phone,
                base_salary: baseSalary,
                business_id: data.businessId,
                active: data.active ?? true,
            });

        if (error) {
            console.error('Create employee error:', error);
            return { error: 'Failed to create employee' };
        }

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Create employee error:', error);
        return { error: 'Failed to create employee' };
    }
}

export async function updateEmployee(id: string, data: EmployeeInput) {
    try {
        // Check if employee exists
        const { data: employee } = await supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .single();

        if (!employee) return { error: 'Employee record not found' };

        const name = normalizeText(data.name);
        if (!name) return { error: 'Employee name is required' };

        const role = normalizeText(data.role);
        if (!role) return { error: 'Role is required' };

        const phone = normalizeText(data.phone);
        if (!phone) return { error: 'Phone is required' };

        const baseSalary = parsePositiveAmount(data.baseSalary);
        if (!baseSalary) return { error: 'Base salary must be greater than 0' };

        if (!isValidBusiness(data.businessId)) {
            return { error: 'Business must be travel or isp' };
        }

        const { error } = await supabase
            .from('employees')
            .update({
                name,
                role,
                phone,
                base_salary: baseSalary,
                business_id: data.businessId,
                active: data.active ?? true,
            })
            .eq('id', id);

        if (error) {
            console.error('Update employee error:', error);
            return { error: 'Failed to update employee' };
        }

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Update employee error:', error);
        return { error: 'Failed to update employee' };
    }
}

export async function deleteEmployee(id: string) {
    try {
        // Check if employee exists
        const { data: employee } = await supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .single();

        if (!employee) return { error: 'Employee record not found' };

        const { error } = await supabase
            .from('employees')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete employee error:', error);
            return { error: 'Failed to delete employee' };
        }

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Delete employee error:', error);
        return { error: 'Failed to delete employee' };
    }
}
