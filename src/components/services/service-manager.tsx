'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Inbox, Pencil, Plus, Trash2, User, Plane, FileText, Stethoscope, GraduationCap, Building2, Briefcase } from 'lucide-react';
import { createService, deleteService, deliverService, getServices, updateService } from '@/actions/services';
import type { ServiceInput } from '@/actions/services';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ServiceRow = {
    _id: string;
    name: string;
    description: string;
    category: string;
    serviceType: 'visa' | 'air_ticket' | 'medical' | 'taqamul' | 'hotel' | 'package' | 'other';
    price: number;
    cost: number;
    profit: number;
    status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
    customerId: string;
    customerName: string;
    customerPhone: string;
    vendorId: string;
    vendorName: string;
    deliveryDate: string;
    createdAt: string;
};

type Option = {
    _id: string;
    name: string;
};

type VendorTemplateOption = {
    name: string;
    serviceType: 'visa' | 'air_ticket' | 'medical' | 'taqamul' | 'hotel' | 'package' | 'other';
    category: string;
    defaultPrice: number;
    defaultCost: number;
};

type VendorOption = Option & {
    serviceTemplates?: VendorTemplateOption[];
};

type ServiceManagerProps = {
    services: ServiceRow[];
    customers: Option[];
    vendors: VendorOption[];
    initialCustomerId?: string;
    initialVendorId?: string;
    autoOpenCreate?: boolean;
};

type FormState = {
    name: string;
    description: string;
    category: string;
    serviceType: 'visa' | 'air_ticket' | 'medical' | 'taqamul' | 'hotel' | 'package' | 'other';
    price: string;
    cost: string;
    status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
    customerId: string;
    vendorId: string;
    deliveryDate: string;
};

const serviceTypeIcons: Record<string, React.ReactNode> = {
    visa: <FileText className="h-4 w-4" />,
    air_ticket: <Plane className="h-4 w-4" />,
    medical: <Stethoscope className="h-4 w-4" />,
    taqamul: <GraduationCap className="h-4 w-4" />,
    hotel: <Building2 className="h-4 w-4" />,
    package: <User className="h-4 w-4" />,
    other: <FileText className="h-4 w-4" />,
};

const serviceTypeLabels: Record<string, string> = {
    visa: 'Visa',
    air_ticket: 'Air Ticket',
    medical: 'Medical',
    taqamul: 'Taqamul',
    hotel: 'Hotel',
    package: 'Package',
    other: 'Other',
};

function vendorServiceKey(name: string, serviceType: string, category: string) {
    return `${name}::${serviceType}::${category}`;
}

const initialForm: FormState = {
    name: '',
    description: '',
    category: '',
    serviceType: 'visa',
    price: '',
    cost: '',
    status: 'pending',
    customerId: '',
    vendorId: '',
    deliveryDate: '',
};

const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
    ready: 'bg-violet-100 text-violet-700 border-violet-200',
    delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
};

function formatCurrency(amount: number) {
    return `৳${amount.toLocaleString()}`;
}

export function ServiceManager({ services, customers, vendors, initialCustomerId, initialVendorId, autoOpenCreate = false }: ServiceManagerProps) {
    const router = useRouter();
    const didAutoOpen = useRef(false);
    const [rows, setRows] = useState(services);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deliverTargetId, setDeliverTargetId] = useState<string | null>(null);
    const [selectedVendorService, setSelectedVendorService] = useState('');
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all');
    const { toast } = useToast();

    useEffect(() => {
        if (!initialCustomerId) return;
        setSelectedCustomerFilter(initialCustomerId);
        setExpandedCustomers(new Set([initialCustomerId]));
    }, [initialCustomerId]);

    useEffect(() => {
        if (!autoOpenCreate || didAutoOpen.current) return;
        didAutoOpen.current = true;
        setEditingId(null);
        setForm({
            ...initialForm,
            customerId: initialCustomerId || '',
            vendorId: initialVendorId || '',
        });
        setSelectedVendorService('');
        setError('');
        setIsOpen(true);
    }, [autoOpenCreate, initialCustomerId, initialVendorId]);

    const groupedServices = useMemo(() => {
        const groups: Record<string, ServiceRow[]> = {};
        rows.forEach((service) => {
            if (!groups[service.customerId]) {
                groups[service.customerId] = [];
            }
            groups[service.customerId].push(service);
        });
        return groups;
    }, [rows]);

    const customerStats = useMemo(() => {
        const stats: Record<string, { name: string; phone: string; totalServices: number; totalValue: number }> = {};
        rows.forEach((service) => {
            if (!stats[service.customerId]) {
                stats[service.customerId] = {
                    name: service.customerName,
                    phone: service.customerPhone,
                    totalServices: 0,
                    totalValue: 0,
                };
            }
            stats[service.customerId].totalServices += 1;
            stats[service.customerId].totalValue += service.price;
        });
        return stats;
    }, [rows]);

    const totalRevenue = useMemo(() => 
        rows.filter(r => r.status === 'delivered').reduce((sum, row) => sum + row.price, 0), 
    [rows]);

    const totalProfit = useMemo(() =>
        rows.filter(r => r.status === 'delivered').reduce((sum, row) => sum + (row.profit || 0), 0),
    [rows]);

    const pendingServices = useMemo(() => 
        rows.filter(r => r.status === 'pending' || r.status === 'in-progress').length, 
    [rows]);

    const vendorServiceOptions = useMemo(() => {
        if (!form.vendorId) {
            return [] as Array<{ key: string; name: string; serviceType: FormState['serviceType']; category: string; price: number; cost: number }>;
        }

        const vendor = vendors.find((item) => item._id === form.vendorId);
        let options = (vendor?.serviceTemplates ?? []).map((template) => ({
            key: vendorServiceKey(template.name, template.serviceType, template.category),
            name: template.name,
            serviceType: template.serviceType,
            category: template.category,
            price: template.defaultPrice,
            cost: template.defaultCost,
        }));

        if (options.length === 0) {
            options = rows
                .filter((row) => row.vendorId === form.vendorId && row.status !== 'cancelled')
                .map((row) => ({
                    key: vendorServiceKey(row.name, row.serviceType, row.category),
                    name: row.name,
                    serviceType: row.serviceType,
                    category: row.category,
                    price: row.price,
                    cost: row.cost,
                }));
        }

        if (editingId && form.name && form.category) {
            const editKey = vendorServiceKey(form.name, form.serviceType, form.category);
            if (!options.some((item) => item.key === editKey)) {
                options.push({
                    key: editKey,
                    name: form.name,
                    serviceType: form.serviceType,
                    category: form.category,
                    price: Number(form.price) || 0,
                    cost: Number(form.cost) || 0,
                });
            }
        }

        const uniqueByKey = new Map<string, (typeof options)[number]>();
        for (const item of options) {
            if (!uniqueByKey.has(item.key)) {
                uniqueByKey.set(item.key, item);
            }
        }

        return Array.from(uniqueByKey.values());
    }, [vendors, rows, form.vendorId, editingId, form.name, form.category, form.serviceType, form.price, form.cost]);

    const toggleCustomerExpand = (customerId: string) => {
        const newExpanded = new Set(expandedCustomers);
        if (newExpanded.has(customerId)) {
            newExpanded.delete(customerId);
        } else {
            newExpanded.add(customerId);
        }
        setExpandedCustomers(newExpanded);
    };

    function openCreate(customerId?: string) {
        setEditingId(null);
        setForm({
            ...initialForm,
            customerId: customerId || '',
        });
        setSelectedVendorService('');
        setError('');
        setIsOpen(true);
    }

    function openEdit(row: ServiceRow) {
        setEditingId(row._id);
        setForm({
            name: row.name,
            description: row.description,
            category: row.category,
            serviceType: row.serviceType,
            price: String(row.price),
            cost: String(row.cost),
            status: row.status,
            customerId: row.customerId,
            vendorId: row.vendorId,
            deliveryDate: row.deliveryDate ? row.deliveryDate.slice(0, 10) : '',
        });
        setSelectedVendorService(vendorServiceKey(row.name, row.serviceType, row.category));
        setError('');
        setIsOpen(true);
    }

    function openDeliver(row: ServiceRow) {
        setDeliverTargetId(row._id);
        setForm(prev => ({
            ...prev,
            deliveryDate: new Date().toISOString().slice(0, 10),
        }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError('');

        if (!selectedVendorService) {
            setError('Select a vendor service from the list');
            setSaving(false);
            return;
        }

        const payload: ServiceInput = {
            name: form.name,
            description: form.description || undefined,
            category: form.category,
            serviceType: form.serviceType,
            price: Number(form.price),
            cost: form.cost ? Number(form.cost) : 0,
            status: form.status,
            customerId: form.customerId,
            vendorId: form.vendorId,
            deliveryDate: form.deliveryDate || undefined,
        };

        try {
            const result = editingId
                ? await updateService(editingId, payload)
                : await createService(payload);

            if ('error' in result) {
                setError(result.error ?? 'Failed to save service');
                toast({ title: 'Could not save service', description: result.error ?? 'Please try again.', variant: 'error' });
                return;
            }

            const latest = await getServices();
            setRows(latest);
            setIsOpen(false);
            setEditingId(null);
            setForm(initialForm);
            setSelectedVendorService('');
            toast({ 
                title: editingId ? 'Service updated' : 'Service created', 
                variant: 'success',
            });
        } catch {
            setError('Failed to save service');
            toast({ title: 'Could not save service', description: 'Please try again.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    async function handleDeliver() {
        if (!deliverTargetId) return;
        
        setSaving(true);
        try {
            const result = await deliverService(deliverTargetId, form.deliveryDate);
            
            if ('error' in result) {
                toast({ title: 'Could not deliver service', description: result.error ?? 'Please try again.', variant: 'error' });
                return;
            }

            const latest = await getServices();
            setRows(latest);
            setDeliverTargetId(null);
            toast({ title: 'Service delivered', variant: 'success' });
        } catch {
            toast({ title: 'Could not deliver service', description: 'Please try again.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    function handleDelete(id: string) {
        setDeleteTargetId(id);
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        const result = await deleteService(deleteTargetId);
        if (!('error' in result)) {
            setRows((prev) => prev.filter((row) => row._id !== deleteTargetId));
            setDeleteTargetId(null);
            toast({ title: 'Service record deleted', variant: 'success' });
            return;
        }

        toast({ title: 'Delete failed', description: result.error ?? 'Failed to delete service', variant: 'error' });
    }

    const deliverTargetRow = deliverTargetId ? rows.find(r => r._id === deliverTargetId) : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Services</h1>
                    <p className="text-sm text-muted-foreground">Manage service delivery and track profit</p>
                </div>
                <Button onClick={() => openCreate()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Service
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Services</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{rows.length}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold text-blue-600">{pendingServices}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold text-emerald-600">{formatCurrency(totalRevenue)}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold text-violet-600">{formatCurrency(totalProfit)}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Group services by customer</p>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Filter:</span>
                    <Select value={selectedCustomerFilter} onValueChange={setSelectedCustomerFilter}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="All Customers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Customers</SelectItem>
                            {Object.entries(customerStats)
                                .filter(([customerId]) => customerId !== '')
                                .map(([customerId, stats]) => (
                                <SelectItem key={customerId} value={customerId}>
                                    {stats.name} ({stats.totalServices})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Services Grouped by Customer */}
            <div className="space-y-3">
                {Object.keys(groupedServices).length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Inbox className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">No services yet</p>
                        <Button className="mt-4" onClick={() => openCreate()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add first service
                        </Button>
                    </div>
                ) : (
                    Object.entries(groupedServices)
                        .filter(([customerId]) => selectedCustomerFilter === 'all' || customerId === selectedCustomerFilter)
                        .map(([customerId, customerServices]) => {
                            const stats = customerStats[customerId];
                            const isExpanded = expandedCustomers.has(customerId);
                            
                            return (
                                <div key={customerId} className="overflow-hidden rounded-lg border border-border bg-card">
                                    {/* Customer Header */}
                                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleCustomerExpand(customerId)}
                                            className="flex flex-1 items-center gap-3"
                                        >
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                                <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="text-left">
                                                <h3 className="font-medium">{stats?.name || 'Unknown'}</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    {stats?.phone} • {customerServices.length} services • {formatCurrency(stats?.totalValue || 0)}
                                                </p>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="ml-2 h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                                            )}
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <Button 
                                                size="sm" 
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openCreate(customerId);
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (customerId) {
                                                        router.push(`/customers/${customerId}`);
                                                    }
                                                }}
                                            >
                                                <ArrowUpRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Services Table */}
                                    {isExpanded && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[800px] text-sm">
                                                <thead>
                                                    <tr className="border-b border-border bg-muted/20">
                                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Service</th>
                                                        <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-muted-foreground lg:table-cell">Vendor</th>
                                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                                                        <th className="hidden px-4 py-2.5 text-right text-xs font-medium text-muted-foreground md:table-cell">Cost</th>
                                                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Price</th>
                                                        <th className="hidden px-4 py-2.5 text-right text-xs font-medium text-muted-foreground lg:table-cell">Profit</th>
                                                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {customerServices.map((row) => (
                                                        <tr key={row._id} className="hover:bg-muted/30">
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    {serviceTypeIcons[row.serviceType]}
                                                                    <span className="text-xs text-muted-foreground">{serviceTypeLabels[row.serviceType]}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <p className="font-medium">{row.name}</p>
                                                                <p className="text-xs text-muted-foreground">{row.category}</p>
                                                            </td>
                                                            <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                                                                {row.vendorId ? (
                                                                    <Link href={`/vendors/${row.vendorId}`} className="hover:text-primary hover:underline">
                                                                        {row.vendorName || '-'}
                                                                    </Link>
                                                                ) : (
                                                                    row.vendorName || '-'
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[row.status]}`}>
                                                                    {row.status}
                                                                </span>
                                                            </td>
                                                            <td className="hidden px-4 py-2.5 text-right text-muted-foreground md:table-cell">{formatCurrency(row.cost)}</td>
                                                            <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.price)}</td>
                                                            <td className="hidden px-4 py-2.5 text-right font-medium text-emerald-600 lg:table-cell">{formatCurrency(row.profit || 0)}</td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex justify-end gap-1">
                                                                    {row.status !== 'delivered' && row.status !== 'cancelled' && (
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-7 w-7 text-emerald-600"
                                                                            onClick={() => openDeliver(row)}
                                                                        >
                                                                            <CheckCircle2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-7 w-7"
                                                                        onClick={() => openEdit(row)}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-destructive"
                                                                        onClick={() => handleDelete(row._id)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Service' : 'Add Service'}</DialogTitle>
                        <DialogDescription>
                            Select customer, vendor, and service details
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Customer *</Label>
                                <Select
                                    value={form.customerId}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, customerId: value }))}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((customer) => (
                                            <SelectItem key={customer._id} value={customer._id}>
                                                {customer.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Vendor *</Label>
                                <Select
                                    value={form.vendorId}
                                    onValueChange={(value) => {
                                        setForm((prev) => ({
                                            ...prev,
                                            vendorId: value,
                                            name: '',
                                            category: '',
                                            serviceType: 'visa',
                                            price: '',
                                            cost: '',
                                        }));
                                        setSelectedVendorService('');
                                    }}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendors.map((vendor) => (
                                            <SelectItem key={vendor._id} value={vendor._id}>
                                                {vendor.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 sm:col-span-2">
                                <Label>Vendor Service *</Label>
                                <Select
                                    value={selectedVendorService}
                                    onValueChange={(value) => {
                                        setSelectedVendorService(value);
                                        const selected = vendorServiceOptions.find((item) => item.key === value);
                                        if (!selected) return;
                                        setForm((prev) => ({
                                            ...prev,
                                            name: selected.name,
                                            serviceType: selected.serviceType,
                                            category: selected.category,
                                            price: String(selected.price),
                                            cost: String(selected.cost || 0),
                                        }));
                                    }}
                                    disabled={!form.vendorId || vendorServiceOptions.length === 0}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={form.vendorId ? (vendorServiceOptions.length > 0 ? 'Select service' : 'No services available') : 'Select vendor first'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendorServiceOptions.map((option) => (
                                            <SelectItem key={option.key} value={option.key}>
                                                {option.name} - {formatCurrency(option.price)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value: FormState['status']) => setForm((prev) => ({ ...prev, status: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                        <SelectItem value="ready">Ready</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Expected Delivery Date</Label>
                                <Input
                                    type="date"
                                    value={form.deliveryDate}
                                    onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                                />
                            </div>
                        </div>

                        {selectedVendorService && form.price && form.cost && (
                            <div className="rounded-lg border border-border bg-muted/30 p-4">
                                <p className="mb-2 text-sm font-medium">Pricing Summary</p>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Customer Price</p>
                                        <p className="text-lg font-semibold">{formatCurrency(Number(form.price))}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Vendor Cost</p>
                                        <p className="text-lg font-semibold">{formatCurrency(Number(form.cost))}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Profit</p>
                                        <p className="text-lg font-semibold text-emerald-600">{formatCurrency(Number(form.price) - Number(form.cost))}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Deliver Dialog */}
            <Dialog open={Boolean(deliverTargetId)} onOpenChange={(open) => { if (!open) setDeliverTargetId(null); }}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Mark as Delivered</DialogTitle>
                        <DialogDescription>Update service status to delivered</DialogDescription>
                    </DialogHeader>

                    {deliverTargetRow && (
                        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Service:</span>
                                <span className="font-medium">{deliverTargetRow.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Customer:</span>
                                <span>{deliverTargetRow.customerName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-semibold text-emerald-600">{formatCurrency(deliverTargetRow.price)}</span>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Delivery Date</Label>
                        <Input
                            type="date"
                            value={form.deliveryDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeliverTargetId(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleDeliver} disabled={saving}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {saving ? 'Processing...' : 'Mark Delivered'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deleteTargetId)}
                onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
                title="Delete service"
                description="This action cannot be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDelete}
            />
        </div>
    );
}
