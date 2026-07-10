CREATE DATABASE IF NOT EXISTS `CPAC_SB&M`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `CPAC_SB&M`;

DELIMITER //

CREATE PROCEDURE create_index_if_missing(
  IN table_name_value VARCHAR(255),
  IN index_name_value VARCHAR(255),
  IN create_index_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = table_name_value
      AND index_name = index_name_value
  ) THEN
    SET @create_index_sql = create_index_sql;
    PREPARE create_index_statement FROM @create_index_sql;
    EXECUTE create_index_statement;
    DEALLOCATE PREPARE create_index_statement;
  END IF;
END //

DELIMITER ;

CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(255) PRIMARY KEY,
  is_admin BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) DEFAULT 'employee',
  created_at BIGINT,
  sso_subject VARCHAR(255) NULL,
  email VARCHAR(320) NULL,
  display_name VARCHAR(255) NULL,
  sso_user_id VARCHAR(255) NULL,
  department VARCHAR(255) NULL,
  division VARCHAR(255) NULL,
  last_login_at BIGINT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'users',
  'users_sso_subject_idx',
  'CREATE UNIQUE INDEX users_sso_subject_idx ON users (sso_subject)'
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  `imageDataUrl` LONGTEXT,
  `productImportType` VARCHAR(50),
  unit VARCHAR(50),
  type VARCHAR(50),
  quantity DECIMAL(15,4),
  price DECIMAL(15,4),
  `costPrice` DECIMAL(15,4),
  `costCurrency` VARCHAR(10),
  date VARCHAR(50),
  `expiryDate` VARCHAR(50),
  `issueKey` VARCHAR(100),
  requester VARCHAR(255),
  approver VARCHAR(255),
  note TEXT,
  `createdAt` BIGINT,
  status VARCHAR(50) DEFAULT 'confirmed'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'transactions',
  'transactions_created_at_idx',
  'CREATE INDEX transactions_created_at_idx ON transactions (`createdAt` DESC)'
);
CALL create_index_if_missing(
  'transactions',
  'transactions_issue_key_idx',
  'CREATE INDEX transactions_issue_key_idx ON transactions (`issueKey`)'
);
CALL create_index_if_missing(
  'transactions',
  'transactions_status_idx',
  'CREATE INDEX transactions_status_idx ON transactions (status)'
);
CALL create_index_if_missing(
  'transactions',
  'transactions_type_idx',
  'CREATE INDEX transactions_type_idx ON transactions (type)'
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) DEFAULT '',
  category VARCHAR(255) DEFAULT '-',
  `productImportType` VARCHAR(50) DEFAULT 'resale',
  `imageDataUrl` LONGTEXT,
  unit VARCHAR(50) NOT NULL,
  price DECIMAL(15,4) DEFAULT 0,
  `costPrice` DECIMAL(15,4) DEFAULT 0,
  `costCurrency` VARCHAR(10) DEFAULT 'THB',
  `defaultStorageLocation` VARCHAR(255) DEFAULT '',
  `defaultExpiryDate` VARCHAR(50) DEFAULT '',
  vendor VARCHAR(255) DEFAULT '',
  note TEXT,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` BIGINT,
  `updatedAt` BIGINT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'products',
  'products_active_updated_idx',
  'CREATE INDEX products_active_updated_idx ON products (`isActive` DESC, `updatedAt` DESC)'
);
CALL create_index_if_missing(
  'products',
  'products_lookup_idx',
  'CREATE INDEX products_lookup_idx ON products (name, sku, category, `productImportType`, unit)'
);

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON NULL,
  created_at BIGINT,
  updated_at BIGINT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO roles (id, name, description, permissions, created_at, updated_at)
VALUES
  ('employee', 'พนักงาน', 'สร้างใบเบิกและติดตามสถานะใบเบิกของตนเอง', JSON_ARRAY('request:create', 'request:cancel_own'), UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000, UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000),
  ('manager', 'ผู้จัดการ', 'ใช้งานเหมือนพนักงาน ดูภาพรวมคลัง และอนุมัติใบเบิก', JSON_ARRAY('stock:view', 'request:approve', 'request:reject'), UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000, UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000),
  ('admin', 'แอดมิน', 'จัดการสินค้า ผู้ใช้ สิทธิ์ ระบบ และข้อมูลคลังทั้งหมด', JSON_ARRAY('admin:*'), UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000, UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  permissions = VALUES(permissions),
  updated_at = VALUES(updated_at);

CREATE TABLE IF NOT EXISTS stock_lots (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(100) NULL,
  lot_no VARCHAR(100) DEFAULT '',
  expiry_date VARCHAR(50) DEFAULT '',
  storage_location VARCHAR(255) DEFAULT '',
  received_quantity DECIMAL(15,4) DEFAULT 0,
  issued_quantity DECIMAL(15,4) DEFAULT 0,
  balance_quantity DECIMAL(15,4) DEFAULT 0,
  unit_cost DECIMAL(15,4) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'THB',
  source_transaction_id VARCHAR(100) NULL,
  created_by VARCHAR(255) DEFAULT '',
  created_at BIGINT,
  updated_at BIGINT,
  CONSTRAINT stock_lots_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT stock_lots_source_transaction_fk
    FOREIGN KEY (source_transaction_id) REFERENCES transactions(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'stock_lots',
  'stock_lots_product_idx',
  'CREATE INDEX stock_lots_product_idx ON stock_lots (product_id)'
);
CALL create_index_if_missing(
  'stock_lots',
  'stock_lots_expiry_idx',
  'CREATE INDEX stock_lots_expiry_idx ON stock_lots (expiry_date)'
);
CALL create_index_if_missing(
  'stock_lots',
  'stock_lots_balance_idx',
  'CREATE INDEX stock_lots_balance_idx ON stock_lots (balance_quantity)'
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(100) NULL,
  lot_id VARCHAR(100) NULL,
  transaction_id VARCHAR(100) NULL,
  movement_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit VARCHAR(50) DEFAULT '',
  unit_cost DECIMAL(15,4) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'THB',
  reference_type VARCHAR(50) DEFAULT '',
  reference_id VARCHAR(100) DEFAULT '',
  status VARCHAR(50) DEFAULT 'confirmed',
  note TEXT,
  performed_by VARCHAR(255) DEFAULT '',
  performed_at BIGINT,
  created_at BIGINT,
  CONSTRAINT stock_movements_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT stock_movements_lot_fk
    FOREIGN KEY (lot_id) REFERENCES stock_lots(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT stock_movements_transaction_fk
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'stock_movements',
  'stock_movements_product_idx',
  'CREATE INDEX stock_movements_product_idx ON stock_movements (product_id)'
);
CALL create_index_if_missing(
  'stock_movements',
  'stock_movements_lot_idx',
  'CREATE INDEX stock_movements_lot_idx ON stock_movements (lot_id)'
);
CALL create_index_if_missing(
  'stock_movements',
  'stock_movements_type_status_idx',
  'CREATE INDEX stock_movements_type_status_idx ON stock_movements (movement_type, status)'
);
CALL create_index_if_missing(
  'stock_movements',
  'stock_movements_performed_at_idx',
  'CREATE INDEX stock_movements_performed_at_idx ON stock_movements (performed_at)'
);

CREATE TABLE IF NOT EXISTS requisitions (
  id VARCHAR(100) PRIMARY KEY,
  issue_key VARCHAR(100) UNIQUE,
  requester VARCHAR(255) DEFAULT '',
  requester_user_id VARCHAR(255) DEFAULT '',
  department VARCHAR(255) DEFAULT '',
  status VARCHAR(50) DEFAULT 'pending',
  requested_at BIGINT,
  approved_at BIGINT NULL,
  completed_at BIGINT NULL,
  cancelled_at BIGINT NULL,
  note TEXT,
  created_at BIGINT,
  updated_at BIGINT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'requisitions',
  'requisitions_status_idx',
  'CREATE INDEX requisitions_status_idx ON requisitions (status)'
);
CALL create_index_if_missing(
  'requisitions',
  'requisitions_requester_idx',
  'CREATE INDEX requisitions_requester_idx ON requisitions (requester)'
);
CALL create_index_if_missing(
  'requisitions',
  'requisitions_requested_at_idx',
  'CREATE INDEX requisitions_requested_at_idx ON requisitions (requested_at)'
);

CREATE TABLE IF NOT EXISTS requisition_items (
  id VARCHAR(100) PRIMARY KEY,
  requisition_id VARCHAR(100) NOT NULL,
  product_id VARCHAR(100) NULL,
  lot_id VARCHAR(100) NULL,
  transaction_id VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) DEFAULT '',
  category VARCHAR(255) DEFAULT '-',
  unit VARCHAR(50) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  note TEXT,
  created_at BIGINT,
  updated_at BIGINT,
  CONSTRAINT requisition_items_requisition_fk
    FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT requisition_items_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT requisition_items_lot_fk
    FOREIGN KEY (lot_id) REFERENCES stock_lots(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT requisition_items_transaction_fk
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'requisition_items',
  'requisition_items_requisition_idx',
  'CREATE INDEX requisition_items_requisition_idx ON requisition_items (requisition_id)'
);
CALL create_index_if_missing(
  'requisition_items',
  'requisition_items_product_idx',
  'CREATE INDEX requisition_items_product_idx ON requisition_items (product_id)'
);
CALL create_index_if_missing(
  'requisition_items',
  'requisition_items_status_idx',
  'CREATE INDEX requisition_items_status_idx ON requisition_items (status)'
);

CREATE TABLE IF NOT EXISTS approvals (
  id VARCHAR(100) PRIMARY KEY,
  requisition_id VARCHAR(100) NULL,
  issue_key VARCHAR(100) DEFAULT '',
  approver VARCHAR(255) DEFAULT '',
  approver_user_id VARCHAR(255) DEFAULT '',
  action VARCHAR(50) NOT NULL,
  from_status VARCHAR(50) DEFAULT '',
  to_status VARCHAR(50) DEFAULT '',
  note TEXT,
  acted_at BIGINT,
  created_at BIGINT,
  CONSTRAINT approvals_requisition_fk
    FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'approvals',
  'approvals_requisition_idx',
  'CREATE INDEX approvals_requisition_idx ON approvals (requisition_id)'
);
CALL create_index_if_missing(
  'approvals',
  'approvals_issue_key_idx',
  'CREATE INDEX approvals_issue_key_idx ON approvals (issue_key)'
);
CALL create_index_if_missing(
  'approvals',
  'approvals_acted_at_idx',
  'CREATE INDEX approvals_acted_at_idx ON approvals (acted_at)'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  actor VARCHAR(255) DEFAULT '',
  actor_user_id VARCHAR(255) DEFAULT '',
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) DEFAULT '',
  before_data JSON NULL,
  after_data JSON NULL,
  ip_address VARCHAR(100) DEFAULT '',
  user_agent TEXT,
  created_at BIGINT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL create_index_if_missing(
  'audit_logs',
  'audit_logs_actor_idx',
  'CREATE INDEX audit_logs_actor_idx ON audit_logs (actor)'
);
CALL create_index_if_missing(
  'audit_logs',
  'audit_logs_entity_idx',
  'CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id)'
);
CALL create_index_if_missing(
  'audit_logs',
  'audit_logs_created_at_idx',
  'CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at)'
);

DROP PROCEDURE create_index_if_missing;
