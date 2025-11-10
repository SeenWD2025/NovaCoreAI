-- Usage Ledger Performance Indexes
-- These indexes optimize quota checking and usage statistics queries

-- Index for checking daily usage by user and resource type
-- Used by quota enforcement: "How many tokens/messages has this user used today?"
CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_date 
  ON usage_ledger(user_id, DATE(timestamp), resource_type);

-- Index for time-series queries (usage history)
CREATE INDEX IF NOT EXISTS idx_usage_ledger_timestamp 
  ON usage_ledger(timestamp DESC);

-- Index for resource-specific queries
CREATE INDEX IF NOT EXISTS idx_usage_ledger_resource 
  ON usage_ledger(resource_type, timestamp DESC);

-- Composite index for efficient quota checks
-- Optimizes: SELECT SUM(amount) FROM usage_ledger 
--           WHERE user_id = ? AND resource_type = ? AND DATE(timestamp) = CURRENT_DATE
-- Note: Removed partial index with CURRENT_DATE as it requires IMMUTABLE function
-- Regular composite index still optimizes quota queries effectively
CREATE INDEX IF NOT EXISTS idx_usage_ledger_quota_check 
  ON usage_ledger(user_id, resource_type, timestamp DESC);

-- Add comments for documentation
COMMENT ON TABLE usage_ledger IS 'Tracks resource usage (tokens, messages, API calls) per user for quota enforcement';
COMMENT ON COLUMN usage_ledger.resource_type IS 'Type of resource used: tokens, messages, api_calls, etc.';
COMMENT ON COLUMN usage_ledger.amount IS 'Quantity of resource consumed in this event';
COMMENT ON COLUMN usage_ledger.metadata IS 'Additional context: model used, tier at time of use, etc.';
