-- ============================================
-- Sama Alostoura Rate Library Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create rate_library table
CREATE TABLE IF NOT EXISTS public.rate_library (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_rate DECIMAL(12, 2) NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rate_library_category ON public.rate_library(category);
CREATE INDEX IF NOT EXISTS idx_rate_library_description ON public.rate_library(description);

-- Enable Row Level Security
ALTER TABLE public.rate_library ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all authenticated users
CREATE POLICY "Allow read access to all" 
  ON public.rate_library 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Create policy to allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated users to modify rates" 
  ON public.rate_library 
  FOR ALL 
  TO authenticated 
  USING (true);

-- Insert sample rates (optional - you can modify these)
INSERT INTO public.rate_library (id, description, unit, unit_rate, category, notes) VALUES
  ('rate_mobilization_001', 'Site Mobilization and Setup', 'L.S', 50000, 'Mobilization', 'One-time setup cost'),
  ('rate_excavation_001', 'General Excavation', 'M3', 150, 'Excavation and Backfilling', 'Bulk earthwork'),
  ('rate_concrete_001', 'Concrete Beams and Columns (20 MPa)', 'M3', 450, 'Substructure', 'Structural concrete'),
  ('rate_blockwork_001', 'Concrete Block Work', 'M2', 85, 'Block Works', 'Standard 15cm blocks'),
  ('rate_plaster_int_001', 'Internal Plaster Work (12mm)', 'M2', 65, 'Internal Plaster Works', 'Gypsum plaster finish'),
  ('rate_plaster_ext_001', 'External Plaster Work (20mm)', 'M2', 95, 'External Plaster Works', 'Cement plaster with primer'),
  ('rate_waterproof_001', 'Waterproofing - Terraces', 'M2', 120, 'Water Proofing Works', 'Bituminous membrane'),
  ('rate_electrical_001', 'Electrical Wire and Cable Installation', 'M', 45, 'Electrical & Etisalat works', '2.5 sq mm copper wire'),
  ('rate_plumbing_001', 'PVC Plumbing Pipe Installation', 'M', 65, 'Plumbing & Drainage works', '25mm diameter'),
  ('rate_ac_001', 'AC Duct Installation', 'M', 150, 'Air Condition', 'Standard ducting'),
  ('rate_flooring_001', 'Ceramic Tiles Flooring', 'M2', 180, 'Fixing & Supplying Flooring and Wall Tiling', '60x60 cm tiles'),
  ('rate_painting_001', 'Interior Painting (2 coats)', 'M2', 45, 'Painting Works', 'Emulsion paint'),
  ('rate_doors_001', 'Wooden Door Frame and Shutter', 'NO', 1500, 'Doors and Windows', 'Standard size'),
  ('rate_windows_001', 'Aluminum Window (single glazed)', 'NO', 2500, 'Doors and Windows', 'Standard size');