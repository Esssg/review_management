-- AI 생성 리뷰 본문(주문별) + 리뷰 톤용 사용자 프로필(비식별 위주)

alter table public.orders
  add column if not exists ai_review text;

create table public.user_ai_review_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gender text,
  age_range text,
  region text,
  occupation text,
  extra_context text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_ai_review_profiles_set_updated_at
  before update on public.user_ai_review_profiles
  for each row
  execute procedure public.set_orders_updated_at();

alter table public.user_ai_review_profiles enable row level security;

create policy "user_ai_review_profiles_select_own"
  on public.user_ai_review_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_ai_review_profiles_insert_own"
  on public.user_ai_review_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_ai_review_profiles_update_own"
  on public.user_ai_review_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_ai_review_profiles_delete_own"
  on public.user_ai_review_profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);
