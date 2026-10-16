-- Rollback for ERPFIX-2 (BUG-ERP-03). Removes only the additive schema this
-- phase introduced. Does NOT touch gl_journal_entries/gl_journal_lines rows
-- already written in base currency (that is real posted financial data, not
-- schema) and does NOT touch erp_settings/numbering config.
ALTER TABLE gl_journal_lines DROP COLUMN IF EXISTS fx_amount;
ALTER TABLE gl_journal_lines DROP COLUMN IF EXISTS fx_currency;
-- erp_settings 'fx_precision' intentionally left in place (harmless, config-only).
