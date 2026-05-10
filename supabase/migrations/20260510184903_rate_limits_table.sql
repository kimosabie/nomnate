create table if not exists public.rate_limits (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  action       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 1,
  primary key (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

create policy "Users manage own rate limit rows"
  on public.rate_limits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
