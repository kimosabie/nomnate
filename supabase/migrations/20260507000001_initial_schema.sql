-- NomNate initial schema

create extension if not exists "uuid-ossp";

-- Tables first (no cross-references in table definitions)

create table public.families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(family_id, user_id)
);

create table public.restaurants (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  cuisine text,
  address text,
  google_place_id text,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'voting', 'decided', 'closed')),
  winner_restaurant_id uuid references public.restaurants(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.votes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  value integer not null check (value between -1 and 1),
  created_at timestamptz not null default now(),
  unique(session_id, user_id, restaurant_id)
);

-- Enable RLS on all tables

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.restaurants enable row level security;
alter table public.sessions enable row level security;
alter table public.votes enable row level security;

-- RLS policies for families

create policy "Family members can view their family"
  on public.families for select
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = families.id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create families"
  on public.families for insert
  with check (auth.uid() = created_by);

create policy "Family admins can update their family"
  on public.families for update
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = families.id
        and family_members.user_id = auth.uid()
        and family_members.role = 'admin'
    )
  );

-- RLS policies for family_members

create policy "Members can view family membership"
  on public.family_members for select
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_members.family_id
        and fm.user_id = auth.uid()
    )
  );

create policy "Admins can manage family members"
  on public.family_members for all
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_members.family_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

-- RLS policies for restaurants

create policy "Family members can view restaurants"
  on public.restaurants for select
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = restaurants.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members can add restaurants"
  on public.restaurants for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.family_id = restaurants.family_id
        and family_members.user_id = auth.uid()
    )
  );

-- RLS policies for sessions

create policy "Family members can view sessions"
  on public.sessions for select
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = sessions.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members can create sessions"
  on public.sessions for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.family_id = sessions.family_id
        and family_members.user_id = auth.uid()
    )
    and auth.uid() = created_by
  );

create policy "Session creator can update session"
  on public.sessions for update
  using (auth.uid() = created_by);

-- RLS policies for votes

create policy "Family members can view votes in their sessions"
  on public.votes for select
  using (
    exists (
      select 1 from public.sessions s
      join public.family_members fm on fm.family_id = s.family_id
      where s.id = votes.session_id
        and fm.user_id = auth.uid()
    )
  );

create policy "Users can cast their own votes"
  on public.votes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own votes"
  on public.votes for update
  using (auth.uid() = user_id);

-- Trigger: auto-add family creator as admin member

create or replace function public.handle_new_family()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_family_created
  after insert on public.families
  for each row execute procedure public.handle_new_family();

-- Realtime

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.votes;
