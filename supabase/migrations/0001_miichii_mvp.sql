create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  life_stage text not null default 'hatchling',
  hunger integer not null default 24 check (hunger between 0 and 100),
  mood integer not null default 72 check (mood between 0 and 100),
  energy integer not null default 68 check (energy between 0 and 100),
  health integer not null default 82 check (health between 0 and 100),
  trust integer not null default 42 check (trust between 0 and 100),
  curiosity integer not null default 56 check (curiosity between 0 and 100),
  loneliness integer not null default 20 check (loneliness between 0 and 100),
  stress integer not null default 14 check (stress between 0 and 100),
  cleanliness integer not null default 76 check (cleanliness between 0 and 100),
  personality_traits jsonb not null default '{"gentle": 1, "bold": 0, "patient": 0}'::jsonb,
  last_simulated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.environments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  name text not null default 'Pocket room',
  ambience jsonb not null default '{"light": "soft", "sound": "beep"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id)
);

create table if not exists public.environment_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  environment_id uuid not null references public.environments(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  object_type text not null,
  name text not null,
  effects jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null,
  title text not null,
  description text not null,
  stat_changes jsonb not null default '{}'::jsonb,
  source text not null check (source in ('user', 'simulation', 'ai')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pet_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null,
  title text not null,
  description text not null,
  strength integer not null default 10 check (strength between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, type)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  item_type text not null,
  name text not null,
  quantity integer not null default 1 check (quantity >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  elapsed_hours numeric not null default 0,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generated_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  provider text not null default 'mock',
  request_payload jsonb not null default '{}'::jsonb,
  raw_output jsonb not null default '{}'::jsonb,
  validated_output jsonb not null default '{}'::jsonb,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.environments enable row level security;
alter table public.environment_objects enable row level security;
alter table public.pet_events enable row level security;
alter table public.pet_memories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.user_actions enable row level security;
alter table public.simulation_runs enable row level security;
alter table public.ai_generated_events enable row level security;

create policy "profiles are owned by user" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "pets are owned by user" on public.pets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "environments are owned by user" on public.environments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "environment objects are owned by user" on public.environment_objects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pet events are owned by user" on public.pet_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pet memories are owned by user" on public.pet_memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "inventory items are owned by user" on public.inventory_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user actions are owned by user" on public.user_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "simulation runs are owned by user" on public.simulation_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai generated events are owned by user" on public.ai_generated_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger pets_touch_updated_at
  before update on public.pets
  for each row execute function public.touch_updated_at();

create trigger environments_touch_updated_at
  before update on public.environments
  for each row execute function public.touch_updated_at();

create trigger environment_objects_touch_updated_at
  before update on public.environment_objects
  for each row execute function public.touch_updated_at();

create trigger pet_memories_touch_updated_at
  before update on public.pet_memories
  for each row execute function public.touch_updated_at();

create trigger inventory_items_touch_updated_at
  before update on public.inventory_items
  for each row execute function public.touch_updated_at();
