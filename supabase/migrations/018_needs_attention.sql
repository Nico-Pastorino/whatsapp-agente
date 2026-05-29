-- Migration 018: Add needs_attention flag to conversations
-- When the AI detects a handoff phrase and switches to HUMAN mode,
-- this flag is set to true so the team knows the conversation needs pickup.
-- It's cleared automatically when a human sends a message from the dashboard.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to quickly find conversations needing attention (inbox badge / filter)
CREATE INDEX IF NOT EXISTS idx_conversations_needs_attention
  ON conversations (business_id, needs_attention)
  WHERE needs_attention = TRUE;
