create table if not exists todo_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  category text not null default 'improvement' check (category in ('bug', 'feature', 'improvement', 'content')),
  source_feedback_ids text[] not null default '{}',
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table todo_items enable row level security;
