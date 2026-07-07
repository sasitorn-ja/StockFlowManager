CREATE TABLE IF NOT EXISTS stock_flow_admin_users (
  username VARCHAR(255) PRIMARY KEY,
  is_admin BOOLEAN DEFAULT TRUE,
  role VARCHAR(50) DEFAULT 'admin',
  created_at BIGINT,
  sso_subject VARCHAR(255),
  email VARCHAR(320),
  display_name VARCHAR(255),
  sso_user_id VARCHAR(255),
  department VARCHAR(255),
  division VARCHAR(255),
  last_login_at BIGINT
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_flow_admin_users_sso_subject_idx
ON stock_flow_admin_users (sso_subject) WHERE sso_subject IS NOT NULL;

INSERT INTO stock_flow_admin_users (username, is_admin, role, created_at)
VALUES
  ('สมหญิง', FALSE, 'employee', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('สมชาย', FALSE, 'employee', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('ผู้จัดการ', FALSE, 'manager', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('แอดมิน', TRUE, 'admin', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS stock_flow_transactions (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  "imageDataUrl" TEXT,
  "productImportType" VARCHAR(50),
  unit VARCHAR(50),
  type VARCHAR(50),
  quantity NUMERIC,
  price NUMERIC,
  "costPrice" NUMERIC,
  "costCurrency" VARCHAR(10),
  date VARCHAR(50),
  "expiryDate" VARCHAR(50),
  "issueKey" VARCHAR(100),
  requester VARCHAR(255),
  approver VARCHAR(255),
  note TEXT,
  "createdAt" BIGINT,
  status VARCHAR(50) DEFAULT 'confirmed'
);

CREATE INDEX IF NOT EXISTS stock_flow_transactions_created_at_idx ON stock_flow_transactions ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS stock_flow_transactions_issue_key_idx ON stock_flow_transactions ("issueKey");
CREATE INDEX IF NOT EXISTS stock_flow_transactions_status_idx ON stock_flow_transactions (status);
CREATE INDEX IF NOT EXISTS stock_flow_transactions_type_idx ON stock_flow_transactions (type);

CREATE TABLE IF NOT EXISTS stock_flow_master_products (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) DEFAULT '',
  category VARCHAR(255) DEFAULT '-',
  "productImportType" VARCHAR(50) DEFAULT 'resale',
  "imageDataUrl" TEXT DEFAULT '',
  unit VARCHAR(50) NOT NULL,
  price NUMERIC DEFAULT 0,
  "costPrice" NUMERIC DEFAULT 0,
  "costCurrency" VARCHAR(10) DEFAULT 'THB',
  "defaultStorageLocation" VARCHAR(255) DEFAULT '',
  "defaultExpiryDate" VARCHAR(50) DEFAULT '',
  vendor VARCHAR(255) DEFAULT '',
  note TEXT DEFAULT '',
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" BIGINT,
  "updatedAt" BIGINT
);

CREATE INDEX IF NOT EXISTS stock_flow_master_products_active_updated_idx
  ON stock_flow_master_products ("isActive" DESC, "updatedAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS stock_flow_master_products_sku_unique_idx
  ON stock_flow_master_products (LOWER(sku))
  WHERE sku IS NOT NULL AND sku <> '';

CREATE INDEX IF NOT EXISTS stock_flow_master_products_lookup_idx
  ON stock_flow_master_products (
    LOWER(name),
    LOWER(category),
    LOWER(unit),
    LOWER("productImportType")
  );
