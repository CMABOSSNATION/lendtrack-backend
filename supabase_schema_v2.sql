-- ============================================================
-- LendTrack v2 Database Schema — UPDATED
-- Run this in Supabase SQL Editor (new install)
-- For upgrades, use the ALTER TABLE section at the bottom
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  branch TEXT DEFAULT '',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invite keys
CREATE TABLE IF NOT EXISTS invite_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT,
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Borrowers (photos as base64 TEXT — no Supabase Storage needed)
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  id_type TEXT DEFAULT 'National ID (NIN)',
  id_no TEXT,
  -- Photos stored as compressed base64 data-URIs (~50KB each max)
  passport_photo TEXT,
  id_photo TEXT,
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
  penalty_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  penalty_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  method TEXT DEFAULT 'Cash' CHECK (method IN ('Cash','Mobile Money (MTN)','Mobile Money (Airtel)','Bank Transfer','Cheque','Other')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credit score history (optional server-side log; primary scores computed client-side)
CREATE TABLE IF NOT EXISTS credit_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  label TEXT NOT NULL,
  on_time_count INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  paid_loans INTEGER DEFAULT 0,
  total_paid NUMERIC(14,2) DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_borrowers_user ON borrowers(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_keys_key ON invite_keys(key);
CREATE INDEX IF NOT EXISTS idx_credit_history_borrower ON credit_score_history(borrower_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_access" ON users USING (true);
CREATE POLICY "service_access" ON borrowers USING (true);
CREATE POLICY "service_access" ON loans USING (true);
CREATE POLICY "service_access" ON payments USING (true);
CREATE POLICY "service_access" ON invite_keys USING (true);
CREATE POLICY "service_access" ON credit_score_history USING (true);

-- ── Seed invite key ───────────────────────────────────────────────────────────
INSERT INTO invite_keys (key, label)
VALUES ('LENDTRACK-2026-ADMIN', 'Master key — give to approved buyers')
ON CONFLICT (key) DO NOTHING;

-- ── UPGRADE from v1 (run only if upgrading, not fresh install) ────────────────
-- ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS passport_photo TEXT;
-- ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS id_photo TEXT;
-- ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
-- ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_note TEXT DEFAULT '';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
-- CREATE TABLE IF NOT EXISTS invite_keys (...see above...);
-- CREATE TABLE IF NOT EXISTS credit_score_history (...see above...);
