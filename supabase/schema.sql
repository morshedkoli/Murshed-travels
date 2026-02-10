-- BizLedger Supabase Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Cash', 'Bank', 'Mobile Banking')),
    balance DECIMAL(15, 2) DEFAULT 0,
    account_number VARCHAR(100),
    bank_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_accounts_type ON accounts(type);

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255),
    address TEXT,
    balance DECIMAL(15, 2) DEFAULT 0,
    passport_number VARCHAR(100),
    nationality VARCHAR(100),
    date_of_birth DATE,
    frequent_flyer_number VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(100),
    emergency_contact_relation VARCHAR(100),
    total_services INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_passport ON customers(passport_number);
CREATE INDEX idx_customers_name ON customers USING gin(to_tsvector('simple', name));

-- Vendors table
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    email VARCHAR(255),
    commission_type VARCHAR(50) DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percentage')),
    commission_value DECIMAL(15, 2) DEFAULT 0,
    contact_person_name VARCHAR(255),
    contact_person_phone VARCHAR(100),
    contact_person_email VARCHAR(255),
    bank_account_name VARCHAR(255),
    bank_account_number VARCHAR(100),
    bank_name VARCHAR(255),
    bank_branch VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    balance DECIMAL(15, 2) DEFAULT 0,
    total_services_provided INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vendors_status ON vendors(status);

-- Vendor service categories (many-to-many relationship)
CREATE TABLE vendor_service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL CHECK (category IN ('visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'transport', 'package', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(vendor_id, category)
);

CREATE INDEX idx_vendor_categories_vendor ON vendor_service_categories(vendor_id);
CREATE INDEX idx_vendor_categories_category ON vendor_service_categories(category);

-- Vendor service templates
CREATE TABLE vendor_service_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL CHECK (service_type IN ('visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'package', 'other')),
    category VARCHAR(255) NOT NULL,
    default_price DECIMAL(15, 2) NOT NULL CHECK (default_price >= 0),
    default_cost DECIMAL(15, 2) NOT NULL CHECK (default_cost >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vendor_templates_vendor ON vendor_service_templates(vendor_id);

-- Services table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255) NOT NULL,
    price DECIMAL(15, 2) NOT NULL CHECK (price >= 0),
    cost DECIMAL(15, 2) NOT NULL CHECK (cost >= 0),
    profit DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'ready', 'delivered', 'cancelled')),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    delivery_date TIMESTAMP WITH TIME ZONE,
    expense_recorded BOOLEAN DEFAULT FALSE,
    expense_transaction_id UUID,
    receivable_id UUID,
    payable_id UUID,
    service_type VARCHAR(100) NOT NULL CHECK (service_type IN ('visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'package', 'other')),
    
    -- Visa details
    visa_type VARCHAR(100) CHECK (visa_type IN ('tourist', 'business', 'work', 'student', 'hajj', 'umrah', 'transit')),
    visa_country VARCHAR(255),
    visa_application_date DATE,
    visa_submission_date DATE,
    visa_approval_date DATE,
    visa_number VARCHAR(100),
    visa_expiry_date DATE,
    visa_entry_type VARCHAR(50) CHECK (visa_entry_type IN ('single', 'multiple')),
    visa_duration VARCHAR(100),
    
    -- Air ticket details
    ticket_airline VARCHAR(255),
    ticket_flight_number VARCHAR(100),
    ticket_route_from VARCHAR(255),
    ticket_route_to VARCHAR(255),
    ticket_departure_date TIMESTAMP WITH TIME ZONE,
    ticket_arrival_date TIMESTAMP WITH TIME ZONE,
    ticket_flight_class VARCHAR(50) CHECK (ticket_flight_class IN ('economy', 'business', 'first')),
    ticket_pnr VARCHAR(100),
    ticket_number VARCHAR(100),
    ticket_baggage_allowance VARCHAR(100),
    ticket_is_round_trip BOOLEAN DEFAULT FALSE,
    
    -- Medical details
    medical_center VARCHAR(255),
    medical_appointment_date DATE,
    medical_report_date DATE,
    medical_test_results VARCHAR(50) CHECK (medical_test_results IN ('pass', 'fail', 'pending')),
    medical_certificate_number VARCHAR(100),
    medical_expiry_date DATE,
    
    -- Taqamul details
    taqamul_exam_center VARCHAR(255),
    taqamul_exam_date DATE,
    taqamul_registration_number VARCHAR(100),
    taqamul_result_status VARCHAR(50) CHECK (taqamul_result_status IN ('registered', 'passed', 'failed', 'pending')),
    taqamul_certificate_number VARCHAR(100),
    taqamul_score DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_customer ON services(customer_id);
CREATE INDEX idx_services_vendor ON services(vendor_id);
CREATE INDEX idx_services_service_type ON services(service_type);
CREATE INDEX idx_services_visa_number ON services(visa_number);
CREATE INDEX idx_services_ticket_pnr ON services(ticket_pnr);

-- Service passengers (one-to-many)
CREATE TABLE service_passengers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(255),
    passport_number VARCHAR(100),
    date_of_birth DATE,
    nationality VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_service_passengers_service ON service_passengers(service_id);

-- Service documents (one-to-many)
CREATE TABLE service_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_service_documents_service ON service_documents(service_id);

-- Service status history (one-to-many)
CREATE TABLE service_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_service_status_history_service ON service_status_history(service_id);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(255) NOT NULL,
    business_id VARCHAR(50) DEFAULT 'travel' CHECK (business_id IN ('travel', 'isp')),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    description TEXT,
    reference_id UUID,
    reference_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_vendor ON transactions(vendor_id);
CREATE INDEX idx_transactions_type ON transactions(type);

-- Employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    phone VARCHAR(100) NOT NULL,
    base_salary DECIMAL(15, 2) NOT NULL,
    business_id VARCHAR(50) DEFAULT 'travel' CHECK (business_id IN ('travel', 'isp')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_employees_business ON employees(business_id);
CREATE INDEX idx_employees_active ON employees(active);

-- Salaries table
CREATE TABLE salaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    month VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    business_id VARCHAR(50) DEFAULT 'travel' CHECK (business_id IN ('travel', 'isp')),
    status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
    paid_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_salaries_employee ON salaries(employee_id);
CREATE INDEX idx_salaries_month_year ON salaries(month, year);
CREATE INDEX idx_salaries_status ON salaries(status);

-- Payables table (amounts owed to vendors)
CREATE TABLE payables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id VARCHAR(50) DEFAULT 'travel' CHECK (business_id IN ('travel', 'isp')),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    paid_amount DECIMAL(15, 2) DEFAULT 0 CHECK (paid_amount >= 0),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payables_status ON payables(status);
CREATE INDEX idx_payables_due_date ON payables(due_date);
CREATE INDEX idx_payables_vendor ON payables(vendor_id);

-- Receivables table (amounts due from customers)
CREATE TABLE receivables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id VARCHAR(50) DEFAULT 'travel' CHECK (business_id IN ('travel', 'isp')),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    paid_amount DECIMAL(15, 2) DEFAULT 0 CHECK (paid_amount >= 0),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_receivables_status ON receivables(status);
CREATE INDEX idx_receivables_due_date ON receivables(due_date);
CREATE INDEX idx_receivables_customer ON receivables(customer_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_service_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all access for authenticated users - adjust as needed)
CREATE POLICY "Enable all access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON vendor_service_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON vendor_service_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON service_passengers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON service_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON service_status_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON salaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON payables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON receivables FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendor_service_templates_updated_at BEFORE UPDATE ON vendor_service_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON salaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payables_updated_at BEFORE UPDATE ON payables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_receivables_updated_at BEFORE UPDATE ON receivables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
