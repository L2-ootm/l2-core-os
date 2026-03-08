-- Migration 007: Add recurring events support
-- Adds recurrence fields to events table

ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_end_date TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id TEXT;
