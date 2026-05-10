create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('bug', 'idea', 'feedback')),
  message     text not null,
  page_url    text not null default '',
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Authenticated users can submit their own feedback
create policy "authenticated users can insert feedback"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Any authenticated user can read all feedback (admin page; tighten when roles exist)
create policy "authenticated users can read all feedback"
  on public.feedback for select
  to authenticated
  using (true);
