-- ============================================================
-- LendTrack Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Users table (for lender accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Borrowers
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  id_type TEXT DEFAULT 'PhilSys',
  id_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Loans
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  principal NUMERIC(12,2) NOT NULL,
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  term_days INTEGER NOT NULL DEFAULT 30,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Paid','Overdue','Pending')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  method TEXT DEFAULT 'Cash' CHECK (method IN ('Cash','GCash','Bank Transfer','Maya','Check','Other')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_borrowers_user ON borrowers(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Since we use service key in backend, RLS won't block our API.
-- These policies are a safety net if you ever use anon/user keys.
CREATE POLICY "service_access" ON users USING (true);
CREATE POLICY "service_access" ON borrowers USING (true);
CREATE POLICY "service_access" ON loans USING (true);
CREATE POLICY "service_access" ON payments USING (true);
