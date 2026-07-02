-- BOMBOM Presales Support System — PostgreSQL schema
-- Run with: psql "$DATABASE_URL" -f src/db/schema.sql

CREATE TYPE user_role AS ENUM ('admin', 'presales', 'technical_consultant', 'manager');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'rejected');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'presales',
    status          user_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ
);

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    actor_id        UUID REFERENCES users(id),
    action          TEXT NOT NULL,        -- e.g. 'user.approve', 'user.reject', 'user.login'
    target_type     TEXT,                  -- e.g. 'user', 'product', 'bom_check'
    target_id       TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dell product catalog (E-Codes)
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    e_code          TEXT NOT NULL UNIQUE,          -- e.g. xcto_pb14250_apac
    model_name      TEXT NOT NULL,                  -- e.g. XPS 14
    category        TEXT NOT NULL,                  -- Laptops & 2-in-1s / Desktops & All-in-Ones
    line            TEXT,                            -- XPS / Dell Pro / Dell Pro Rugged / Dell Pro Max
    cpu_options     JSONB DEFAULT '[]',
    ram_options     JSONB DEFAULT '[]',
    storage_options JSONB DEFAULT '[]',
    display_options JSONB DEFAULT '[]',
    warranty_tiers  JSONB DEFAULT '[]',              -- ProSupport tiers
    source_document TEXT,                            -- datasheet filename this was ingested from
    confidence_score NUMERIC(4,3),                    -- AI extraction confidence, null if manually entered
    status          TEXT NOT NULL DEFAULT 'draft',   -- draft | pending_review | published
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compatibility rules feeding the BOM checker (CPU x RAM, Display x power adapter, etc.)
CREATE TABLE compatibility_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    rule_type       TEXT NOT NULL,       -- 'cpu_ram' | 'display_power' | 'storage_cpu' | etc.
    component_a     TEXT NOT NULL,
    component_b     TEXT NOT NULL,
    is_compatible   BOOLEAN NOT NULL,
    source_citation TEXT,                -- page/section of datasheet supporting this rule
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Presales pipeline: Search Email -> Analyze -> Select Specs -> Check BOM
CREATE TABLE cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by      UUID NOT NULL REFERENCES users(id),
    customer_name   TEXT,
    source_email_id TEXT,                -- Outlook message id
    extracted_requirements JSONB DEFAULT '{}',   -- AI-extracted fields from Thai email
    selected_e_code TEXT REFERENCES products(e_code),
    status          TEXT NOT NULL DEFAULT 'draft', -- draft | analyzed | specs_selected | bom_checked | closed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bom_checks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
    uploaded_file    TEXT NOT NULL,        -- original filename
    result          JSONB NOT NULL DEFAULT '{}',  -- pass/fail per line item + reasons
    is_compatible   BOOLEAN,
    checked_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_cases_created_by ON cases(created_by);
CREATE INDEX idx_bom_checks_case_id ON bom_checks(case_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
