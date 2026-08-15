-- PWA Web Push 구독과 구매 예정 알림 내역을 사용자별로 저장합니다.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_label text,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_enabled_idx
  on public.push_subscriptions (user_id, enabled);

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  group_id uuid not null,
  notification_type text not null
    check (notification_type in ('purchase_10m', 'purchase_due')),
  title text not null,
  body text not null,
  target_href text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  read_at timestamptz,
  cancelled_at timestamptz,
  delivery_attempts integer not null default 0
    check (delivery_attempts >= 0),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, scheduled_for, notification_type)
);

create index app_notifications_user_created_at_idx
  on public.app_notifications (user_id, created_at desc);

create index app_notifications_user_unread_idx
  on public.app_notifications (user_id, created_at desc)
  where read_at is null and cancelled_at is null;

create index app_notifications_group_idx
  on public.app_notifications (user_id, group_id, created_at desc);

create index app_notifications_order_unread_idx
  on public.app_notifications (user_id, order_id, created_at desc)
  where read_at is null and cancelled_at is null;

create or replace function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row
  execute procedure public.set_push_subscription_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.app_notifications enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "app_notifications_select_own"
  on public.app_notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "app_notifications_update_read_own"
  on public.app_notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.app_notifications to authenticated;
grant update (read_at) on public.app_notifications to authenticated;
revoke all on public.push_subscriptions from anon;
revoke all on public.app_notifications from anon;
