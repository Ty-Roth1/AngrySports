-- Add per-roster player nicknames
alter table rosters add column if not exists nickname text;
