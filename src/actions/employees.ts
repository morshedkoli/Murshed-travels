'use server';

import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Employee from '@/models/Employee';

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
    await connect();
    const employees = await Employee.find({}).sort({ createdAt: -1 });

    return employees.map((employee) => ({
        _id: employee._id.toString(),
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        baseSalary: employee.baseSalary,
        active: employee.active,
        businessId: (employee.businessId as BusinessType) ?? 'travel',
        createdAt: employee.createdAt.toISOString(),
    }));
}

export async function createEmployee(data: EmployeeInput) {
    try {
        await connect();

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

        await Employee.create({
            name,
            role,
            phone,
            baseSalary,
            businessId: data.businessId,
            active: data.active ?? true,
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
        await connect();

        const employee = await Employee.findById(id);
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

        employee.name = name;
        employee.role = role;
        employee.phone = phone;
        employee.baseSalary = baseSalary;
        employee.businessId = data.businessId;
        employee.active = data.active ?? true;

        await employee.save();

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Update employee error:', error);
        return { error: 'Failed to update employee' };
    }
}

export async function deleteEmployee(id: string) {
    try {
        await connect();

        const employee = await Employee.findById(id);
        if (!employee) return { error: 'Employee record not found' };

        await Employee.deleteOne({ _id: id });

        revalidateEmployeeViews();
        return { success: true };
    } catch (error) {
        console.error('Delete employee error:', error);
        return { error: 'Failed to delete employee' };
    }
}
