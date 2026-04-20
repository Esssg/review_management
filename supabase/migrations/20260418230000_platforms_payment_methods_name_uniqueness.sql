-- Invite/signup flows often insert per-user copies of master rows. A global UNIQUE(name)
-- on platforms (platforms_name_key) collides with existing system rows (user_id IS NULL).
-- Replace with partial uniques: one name per system catalog, unique name per user for custom rows.

alter table public.platforms drop constraint if exists platforms_name_key;

create unique index if not exists platforms_system_name_unique
  on public.platforms (name)
  where user_id is null;

create unique index if not exists platforms_user_name_unique
  on public.platforms (user_id, name)
  where user_id is not null;

-- Same pattern if payment_methods had a global unique on name (avoids next invite failure).
alter table public.payment_methods drop constraint if exists payment_methods_name_key;

create unique index if not exists payment_methods_system_name_unique
  on public.payment_methods (name)
  where user_id is null;

create unique index if not exists payment_methods_user_name_unique
  on public.payment_methods (user_id, name)
  where user_id is not null;
