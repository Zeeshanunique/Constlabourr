-- =============================================
-- ConstLabour Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. PROFILES TABLE (Users, Workers, Foremen)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('contractor', 'foreman', 'labour')),
  phone TEXT,
  aadhaar_hash TEXT,
  bank_details JSONB DEFAULT '{}',
  skill_level TEXT DEFAULT 'unskilled',
  daily_wage DECIMAL(10,2) DEFAULT 0,
  mess_charge DECIMAL(10,2) DEFAULT 0,
  contractor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  site_id UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_contractor_id ON profiles(contractor_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_site_id ON profiles(site_id);

-- 2. SITES TABLE
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  start_date DATE,
  end_date DATE,
  foreman_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  geo_fence JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sites_contractor_id ON sites(contractor_id);
CREATE INDEX idx_sites_foreman_id ON sites(foreman_id);

-- Add foreign key for profiles.site_id -> sites.id (after sites table exists)
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_site
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;

-- 3. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  break_start TIME,
  break_end TIME,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half-day')),
  total_hours DECIMAL(5,2) DEFAULT 0,
  break_hours DECIMAL(5,2) DEFAULT 0,
  net_work_hours DECIMAL(5,2) DEFAULT 0,
  regular_hours DECIMAL(5,2) DEFAULT 0,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  daily_wage DECIMAL(10,2) DEFAULT 0,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  overtime_rate DECIMAL(10,2) DEFAULT 0,
  daily_payment DECIMAL(10,2) DEFAULT 0,
  overtime_payment DECIMAL(10,2) DEFAULT 0,
  total_payment DECIMAL(10,2) DEFAULT 0,
  geo_location JSONB,
  notes TEXT,
  marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  worker_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, site_id, date)
);

CREATE INDEX idx_attendance_worker_id ON attendance(worker_id);
CREATE INDEX idx_attendance_site_id ON attendance(site_id);
CREATE INDEX idx_attendance_date ON attendance(date);

-- 4. ADVANCES TABLE
CREATE TABLE IF NOT EXISTS advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deducted', 'cancelled')),
  given_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deducted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advances_worker_id ON advances(worker_id);
CREATE INDEX idx_advances_status ON advances(status);

-- 5. PAYROLL TABLE
CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_gross DECIMAL(12,2) DEFAULT 0,
  total_net DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payroll_created_by ON payroll(created_by);
CREATE INDEX idx_payroll_site_id ON payroll(site_id);

-- 6. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank', 'upi', 'cheque')),
  transaction_ref TEXT,
  date DATE NOT NULL,
  payroll_id UUID REFERENCES payroll(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_worker_id ON payments(worker_id);

-- 7. PRODUCTION TABLE
CREATE TABLE IF NOT EXISTS production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  task_type TEXT,
  units INTEGER DEFAULT 0,
  rate_per_unit DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  date DATE NOT NULL,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_production_worker_id ON production(worker_id);
CREATE INDEX idx_production_site_id ON production(site_id);

-- 8. AGREEMENTS TABLE
CREATE TABLE IF NOT EXISTS agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Worker Employment Agreement',
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agreements_contractor_id ON agreements(contractor_id);

-- 9. AGREEMENT ACCEPTANCES TABLE
CREATE TABLE IF NOT EXISTS agreement_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  agreement_version INTEGER NOT NULL,
  signature TEXT,
  ip_address TEXT,
  device_info TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_acceptances_worker_id ON agreement_acceptances(worker_id);
CREATE INDEX idx_acceptances_contractor_id ON agreement_acceptances(contractor_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_acceptances ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by Edge Functions)
-- These policies allow authenticated users basic read access as a safety net

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR auth.uid() = contractor_id);

CREATE POLICY "Service role full access to profiles"
  ON profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to sites"
  ON sites FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to attendance"
  ON attendance FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to advances"
  ON advances FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to payroll"
  ON payroll FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to payments"
  ON payments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to production"
  ON production FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to agreements"
  ON agreements FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to agreement_acceptances"
  ON agreement_acceptances FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agreements_updated_at
  BEFORE UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
