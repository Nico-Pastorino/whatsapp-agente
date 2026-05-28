-- 016_human_takeover.sql
-- Track who took over a conversation in HUMAN mode and when they were last active.
-- Used to: prevent duplicate AI replies, auto-return to AI after inactivity.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS human_last_activity TIMESTAMPTZ;

-- Index to efficiently find stale HUMAN conversations for auto-return-to-AI.
CREATE INDEX IF NOT EXISTS idx_conversations_human_stale
  ON conversations (business_id, human_last_activity)
  WHERE mode = 'HUMAN';
