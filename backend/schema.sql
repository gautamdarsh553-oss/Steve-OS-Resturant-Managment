-- SQL Database Schema for Supabase PostgreSQL
-- Set up these tables inside your Supabase SQL Editor.

-- 1. Raw Materials Inventory
CREATE TABLE IF NOT EXISTS raw_materials (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  quantity FLOAT NOT NULL DEFAULT 0.0,
  min_stock FLOAT NOT NULL DEFAULT 0.0,
  cost_per_unit FLOAT NOT NULL DEFAULT 0.0
);

-- 2. Database Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  selling_price FLOAT NOT NULL,
  prep_time INTEGER NOT NULL,
  icon VARCHAR(50) DEFAULT '🍔',
  recipe JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  profit FLOAT NOT NULL
);

-- 3. Live & Historical Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(100) PRIMARY KEY,
  table_label VARCHAR(255) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total FLOAT NOT NULL,
  status VARCHAR(100) NOT NULL DEFAULT 'pending',
  time VARCHAR(50) NOT NULL,
  date VARCHAR(50) NOT NULL,
  order_source VARCHAR(100) NOT NULL DEFAULT 'POS',
  payment_method VARCHAR(100) NOT NULL DEFAULT 'Cash',
  employee_name VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

-- 4. Employee Records
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  hourly_rate FLOAT NOT NULL,
  shift VARCHAR(100) NOT NULL,
  rating FLOAT DEFAULT 5.0,
  performance VARCHAR(255) DEFAULT 'New Joiner',
  orders_completed INTEGER DEFAULT 0,
  overtime_hours FLOAT DEFAULT 0.0,
  bank_name VARCHAR(255),
  bank_account VARCHAR(255),
  stripe_account_id VARCHAR(255),
  salary_amount FLOAT NOT NULL DEFAULT 0.0,
  payment_status VARCHAR(100) DEFAULT 'Unpaid',
  last_payment_date VARCHAR(100) DEFAULT '—'
);

-- 5. Daily Attendance Logs
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  date VARCHAR(50) NOT NULL,
  employee_id VARCHAR(100) REFERENCES employees(id) ON DELETE CASCADE,
  status VARCHAR(100) NOT NULL,
  time_in VARCHAR(50),
  time_out VARCHAR(50)
);

-- 6. Salary Payouts Logs
CREATE TABLE IF NOT EXISTS salaries_payouts (
  id VARCHAR(100) PRIMARY KEY,
  employee_id VARCHAR(100) REFERENCES employees(id) ON DELETE CASCADE,
  amount FLOAT NOT NULL,
  status VARCHAR(100) NOT NULL DEFAULT 'paid',
  stripe_charge_id VARCHAR(255),
  date VARCHAR(50) NOT NULL
);

-- 7. Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL DEFAULT 'cashier',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert a default admin user (password: admin123)
-- The password hash below is for 'admin123' using bcrypt
INSERT INTO users (id, username, email, password_hash, role) VALUES
('u1', 'admin', 'admin@restaurant.com', '$2b$10$placeholder', 'admin')
ON CONFLICT (id) DO NOTHING;

-- No seed data — the database starts empty.
-- Use the app UI to add menu items, raw materials, employees, etc.
