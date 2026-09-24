-- Sole-broker auto-link notice: motorist must ack before wallet-complete.

alter table motorists
  add column if not exists broker_auto_assigned_at timestamptz,
  add column if not exists broker_auto_assigned_ack_at timestamptz;
