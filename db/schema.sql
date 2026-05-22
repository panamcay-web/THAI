-- ============================================================
-- Thailand TDAC - Supabase Database Schema
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- LEADS TABLE: stores all form submissions
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'completed', 'refunded', 'cancelled')),

  -- Step 1: Personal Info (From Passport)
  family_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  passport_number TEXT NOT NULL,
  nationality TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  occupation TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'undefined')),

  -- Step 1: Residence Info
  country_of_residence TEXT NOT NULL,
  city_of_residence TEXT NOT NULL,
  phone_number TEXT NOT NULL,

  -- Step 2: Arrival Info
  arrival_date TEXT NOT NULL,
  purpose_of_travel TEXT NOT NULL,
  mode_of_transport TEXT NOT NULL,
  flight_number TEXT,

  -- Step 2: Departure Info
  departure_date TEXT NOT NULL,
  mode_of_transport_departure TEXT NOT NULL,
  flight_number_departure TEXT,

  -- Step 2: Accommodation
  accommodation_type TEXT,
  accommodation_address TEXT,
  transit_passenger BOOLEAN DEFAULT FALSE,

  -- Step 3: Contact
  tdac_email TEXT NOT NULL,

  -- Payment
  stripe_payment_intent_id TEXT,
  stripe_payment_status TEXT,
  amount_paid INTEGER,
  currency TEXT DEFAULT 'usd',
  paid_at TIMESTAMPTZ
);

-- PAYMENTS TABLE: stores Stripe payment events
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  lead_id UUID REFERENCES leads(id),
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  receipt_url TEXT,
  raw_event JSONB
);

-- INDEXES for fast queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(tdac_email);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(stripe_payment_intent_id);

-- AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ROW LEVEL SECURITY (disable public access)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Only allow server-side (service key) access
CREATE POLICY "Service role only - leads" ON leads
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only - payments" ON payments
  USING (auth.role() = 'service_role');
