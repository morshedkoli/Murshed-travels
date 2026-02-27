'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    try {
        const employees = await prisma.employee.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return employees.map((employee) => ({
            _id: employee.id,
            name: employee.name,
            role: employee.role,
            phone: employee.phone,
            baseSalary: employee.baseSalary,
            active: employee.active,
            businessId: (employee.businessId as BusinessType) || 'travel',
            createdAt: employee.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
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

        await prisma.employee.create({
            data: {
                name,
                role,
                phone,
                baseSalary,
                businessId: data.businessId,
                active: data.active ?? true,
            }
        });

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Create employee error:', error);
        return { error: 'Failed to create employee' };
    }
}

export async function updateEmployee(id: string, data: EmployeeInput) {
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

        await prisma.employee.update({
            where: { id },
            data: {
                name,
                role,
                phone,
                baseSalary,
                businessId: data.businessId,
                active: data.active ?? true,
            }
        });

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Update employee error:', error);
        return { error: 'Failed to update employee' };
    }
}

export async function deleteEmployee(id: string) {
    try {
        await prisma.employee.delete({
            where: { id }
        });

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Delete employee error:', error);
        return { error: 'Failed to delete employee' };
    }
}
