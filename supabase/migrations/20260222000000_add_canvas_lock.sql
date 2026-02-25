-- Add lock state columns to pixel_grid for admin start/pause controls
-- Run via Supabase SQL Editor if not using Supabase CLI

alter table pixel_grid
  add column lock_state text not null default 'open'
    check (lock_state in ('open', 'paused')),
  add column lock_updated_at timestamptz not null default now();
