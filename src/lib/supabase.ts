import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false
    }
});

export type Database = {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    email: string;
                    password: string;
                    role: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['users']['Insert']>;
            };
            accounts: {
                Row: {
                    id: string;
                    name: string;
                    type: 'Cash' | 'Bank' | 'Mobile Banking';
                    balance: number;
                    account_number: string | null;
                    bank_name: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
            };
            customers: {
                Row: {
                    id: string;
                    name: string;
                    phone: string;
                    email: string | null;
                    address: string | null;
                    balance: number;
                    passport_number: string | null;
                    nationality: string | null;
                    date_of_birth: string | null;
                    frequent_flyer_number: string | null;
                    emergency_contact_name: string | null;
                    emergency_contact_phone: string | null;
                    emergency_contact_relation: string | null;
                    total_services: number;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['customers']['Insert']>;
            };
            vendors: {
                Row: {
                    id: string;
                    name: string;
                    phone: string | null;
                    email: string | null;
                    commission_type: 'fixed' | 'percentage';
                    commission_value: number;
                    contact_person_name: string | null;
                    contact_person_phone: string | null;
                    contact_person_email: string | null;
                    bank_account_name: string | null;
                    bank_account_number: string | null;
                    bank_name: string | null;
                    bank_branch: string | null;
                    status: 'active' | 'inactive' | 'blacklisted';
                    rating: number | null;
                    notes: string | null;
                    balance: number;
                    total_services_provided: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['vendors']['Insert']>;
            };
            vendor_service_categories: {
                Row: {
                    id: string;
                    vendor_id: string;
                    category: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['vendor_service_categories']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['vendor_service_categories']['Insert']>;
            };
            vendor_service_templates: {
                Row: {
                    id: string;
                    vendor_id: string;
                    name: string;
                    service_type: string;
                    category: string;
                    default_price: number;
                    default_cost: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['vendor_service_templates']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['vendor_service_templates']['Insert']>;
            };
            services: {
                Row: {
                    id: string;
                    name: string;
                    description: string | null;
                    category: string;
                    price: number;
                    cost: number;
                    profit: number;
                    status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
                    customer_id: string;
                    vendor_id: string;
                    delivery_date: string | null;
                    expense_recorded: boolean;
                    expense_transaction_id: string | null;
                    receivable_id: string | null;
                    payable_id: string | null;
                    service_type: string;
                    visa_type: string | null;
                    visa_country: string | null;
                    visa_application_date: string | null;
                    visa_submission_date: string | null;
                    visa_approval_date: string | null;
                    visa_number: string | null;
                    visa_expiry_date: string | null;
                    visa_entry_type: string | null;
                    visa_duration: string | null;
                    ticket_airline: string | null;
                    ticket_flight_number: string | null;
                    ticket_route_from: string | null;
                    ticket_route_to: string | null;
                    ticket_departure_date: string | null;
                    ticket_arrival_date: string | null;
                    ticket_flight_class: string | null;
                    ticket_pnr: string | null;
                    ticket_number: string | null;
                    ticket_baggage_allowance: string | null;
                    ticket_is_round_trip: boolean;
                    medical_center: string | null;
                    medical_appointment_date: string | null;
                    medical_report_date: string | null;
                    medical_test_results: string | null;
                    medical_certificate_number: string | null;
                    medical_expiry_date: string | null;
                    taqamul_exam_center: string | null;
                    taqamul_exam_date: string | null;
                    taqamul_registration_number: string | null;
                    taqamul_result_status: string | null;
                    taqamul_certificate_number: string | null;
                    taqamul_score: number | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['services']['Insert']>;
            };
            service_passengers: {
                Row: {
                    id: string;
                    service_id: string;
                    name: string | null;
                    passport_number: string | null;
                    date_of_birth: string | null;
                    nationality: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['service_passengers']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['service_passengers']['Insert']>;
            };
            service_documents: {
                Row: {
                    id: string;
                    service_id: string;
                    type: string;
                    url: string;
                    uploaded_at: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['service_documents']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['service_documents']['Insert']>;
            };
            service_status_history: {
                Row: {
                    id: string;
                    service_id: string;
                    status: string;
                    date: string;
                    notes: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['service_status_history']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['service_status_history']['Insert']>;
            };
            transactions: {
                Row: {
                    id: string;
                    date: string;
                    amount: number;
                    type: 'income' | 'expense';
                    category: string;
                    business_id: 'travel' | 'isp';
                    account_id: string;
                    customer_id: string | null;
                    vendor_id: string | null;
                    description: string | null;
                    reference_id: string | null;
                    reference_model: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
            };
            employees: {
                Row: {
                    id: string;
                    name: string;
                    role: string;
                    phone: string;
                    base_salary: number;
                    business_id: 'travel' | 'isp';
                    active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['employees']['Insert']>;
            };
            salaries: {
                Row: {
                    id: string;
                    employee_id: string;
                    amount: number;
                    month: string;
                    year: number;
                    business_id: 'travel' | 'isp';
                    status: 'unpaid' | 'paid';
                    paid_date: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['salaries']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['salaries']['Insert']>;
            };
            payables: {
                Row: {
                    id: string;
                    business_id: 'travel' | 'isp';
                    vendor_id: string;
                    amount: number;
                    paid_amount: number;
                    date: string;
                    due_date: string | null;
                    status: 'unpaid' | 'partial' | 'paid';
                    description: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['payables']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['payables']['Insert']>;
            };
            receivables: {
                Row: {
                    id: string;
                    business_id: 'travel' | 'isp';
                    customer_id: string;
                    amount: number;
                    paid_amount: number;
                    date: string;
                    due_date: string | null;
                    status: 'unpaid' | 'partial' | 'paid';
                    description: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['receivables']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['receivables']['Insert']>;
            };
        };
    };
};
