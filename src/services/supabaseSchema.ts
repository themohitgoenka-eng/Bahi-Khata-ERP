export const SUPABASE_SETUP_SQL = `-- =========================================================================
-- BAHI KHATA ERP - SELF-HEALING & AUTO-EXPANDING SUPABASE DATABASE SCHEMA
-- This script configures all ERP tables, RLS permissions, plus dynamic
-- auto-table creation so any future table added to the app is auto-created!
-- =========================================================================

-- 1. Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    gstin TEXT,
    pan TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    bank_name TEXT,
    bank_account_no TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fiscal Years Table
CREATE TABLE IF NOT EXISTS fiscal_years (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Account Groups Table
CREATE TABLE IF NOT EXISTS account_groups (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    primary_group TEXT,
    account_type TEXT,
    nature TEXT,
    parent_group_id TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ledgers Table (Customers, Suppliers, Expenses, Cash/Bank)
CREATE TABLE IF NOT EXISTS ledgers (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    code TEXT,
    group_id TEXT,
    group_name TEXT,
    account_type TEXT,
    nature TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    pan TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    credit_limit NUMERIC DEFAULT 0,
    credit_period INT DEFAULT 0,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    balance_type TEXT DEFAULT 'Dr',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Locations / Godowns Table
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'GODOWN',
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Item Units Table
CREATE TABLE IF NOT EXISTS item_units (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    formal_name TEXT,
    decimal_places INT DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Inventory Items Table
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    hsn_code TEXT,
    sales_ac TEXT,
    purchase_ac TEXT,
    primary_unit TEXT NOT NULL,
    alternate_unit TEXT,
    conversion_factor NUMERIC DEFAULT 1,
    conversion_direction TEXT DEFAULT 'PRIMARY_TO_ALT',
    decimal_places INT DEFAULT 2,
    sales_rate NUMERIC DEFAULT 0,
    purchase_rate NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 18,
    valuation_method TEXT DEFAULT 'WEIGHTED_AVG',
    opening_qty NUMERIC DEFAULT 0,
    opening_rate NUMERIC DEFAULT 0,
    opening_value NUMERIC DEFAULT 0,
    current_stock NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    uuid TEXT,
    company_id TEXT,
    fiscal_year_id TEXT,
    voucher_number TEXT NOT NULL,
    series_id TEXT,
    series_name TEXT,
    voucher_type TEXT NOT NULL,
    date DATE NOT NULL,
    party_id TEXT,
    party_name TEXT,
    total_amount NUMERIC DEFAULT 0,
    official_amount NUMERIC DEFAULT 0,
    informal_amount NUMERIC DEFAULT 0,
    narration TEXT,
    notes TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    ledger_entries JSONB DEFAULT '[]'::jsonb,
    bill_sundries JSONB DEFAULT '[]'::jsonb,
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Bank Accounts Table
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT DEFAULT 'CURRENT',
    ifsc_code TEXT,
    branch_name TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Stock Transactions Table (Stock Movements Ledger)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    fiscal_year_id TEXT,
    date DATE,
    item_id TEXT,
    voucher_id TEXT,
    voucher_no TEXT,
    voucher_type TEXT,
    transaction_type TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT,
    rate NUMERIC DEFAULT 0,
    value NUMERIC DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Stock Journals Table (Manufacturing, Conversion & Transfers)
CREATE TABLE IF NOT EXISTS stock_journals (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    fiscal_year_id TEXT,
    voucher_no TEXT,
    date DATE,
    journal_type TEXT,
    narration TEXT,
    reference_no TEXT,
    source_items JSONB DEFAULT '[]'::jsonb,
    destination_items JSONB DEFAULT '[]'::jsonb,
    additional_cost NUMERIC DEFAULT 0,
    total_source_qty NUMERIC DEFAULT 0,
    total_source_amount NUMERIC DEFAULT 0,
    total_destination_qty NUMERIC DEFAULT 0,
    total_destination_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'POSTED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Wastage Entries Table (Cutting, Polishing Loss & Breakage)
CREATE TABLE IF NOT EXISTS wastage_entries (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    fiscal_year_id TEXT,
    date DATE,
    item_id TEXT,
    item_name TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT,
    rate NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Bank Transactions Table (Statement Lines & Reconciliation)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    fiscal_year_id TEXT,
    bank_account_id TEXT,
    date DATE,
    narration TEXT,
    reference_no TEXT,
    type TEXT,
    amount NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    reconciliation_status TEXT DEFAULT 'UNMATCHED',
    matched_voucher_id TEXT,
    matched_date DATE,
    match_score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Unit Conversions Table (e.g. 4 SQFT = 1 PCS)
CREATE TABLE IF NOT EXISTS unit_conversions (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    primary_unit TEXT,
    alternate_unit TEXT,
    conversion_factor NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Audit Logs Table (Full Audit Trail of all actions)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    fiscal_year_id TEXT,
    date TIMESTAMPTZ,
    action TEXT,
    entity TEXT,
    entity_id TEXT,
    summary TEXT,
    old_value TEXT,
    new_value TEXT,
    device_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Universal Dynamic Entities Store (Zero Data Loss for Any Future Custom Entity)
CREATE TABLE IF NOT EXISTS app_dynamic_entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    company_id TEXT,
    fiscal_year_id TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dynamic_entity_type ON app_dynamic_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_dynamic_company ON app_dynamic_entities(company_id);

-- =========================================================================
-- PERMISSIONS: Ensure RLS is disabled across all tables
-- =========================================================================
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years DISABLE ROW LEVEL SECURITY;
ALTER TABLE account_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE item_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_journals DISABLE ROW LEVEL SECURITY;
ALTER TABLE wastage_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_dynamic_entities DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- =========================================================================
-- AUTO-PROVISIONING FUNCTION: Dynamically creates new tables from the app!
-- =========================================================================
CREATE OR REPLACE FUNCTION create_app_table_if_missing(p_table_name text, p_columns jsonb DEFAULT '{}'::jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    col_name text;
    col_type text;
BEGIN
    -- Check if table already exists in public schema
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        -- Create table with standard base columns
        EXECUTE format('
            CREATE TABLE public.%I (
                id TEXT PRIMARY KEY,
                company_id TEXT,
                data JSONB DEFAULT ''{}''::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;
            GRANT ALL ON TABLE public.%I TO anon, authenticated;
        ', p_table_name, p_table_name, p_table_name);

        -- Add any custom column definitions passed from the app
        IF p_columns IS NOT NULL AND jsonb_typeof(p_columns) = 'object' THEN
            FOR col_name, col_type IN SELECT * FROM jsonb_each_text(p_columns)
            LOOP
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s;', p_table_name, col_name, col_type);
            END LOOP;
        END IF;

        -- Signal Supabase PostgREST to immediately refresh its schema cache
        NOTIFY pgrst, 'reload schema';
        RETURN 'CREATED';
    ELSE
        -- Table already exists: dynamically add any missing columns
        IF p_columns IS NOT NULL AND jsonb_typeof(p_columns) = 'object' THEN
            FOR col_name, col_type IN SELECT * FROM jsonb_each_text(p_columns)
            LOOP
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s;', p_table_name, col_name, col_type);
            END LOOP;
        END IF;

        NOTIFY pgrst, 'reload schema';
        RETURN 'EXISTS';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION create_app_table_if_missing(text, jsonb) TO anon, authenticated;
`;
