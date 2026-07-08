-- Home v2 MVP PostgreSQL schema starter
-- Run through versioned migrations. Enable pgcrypto for gen_random_uuid().

create extension if not exists pgcrypto;

create type member_role as enum ('admin','adult','teen','child','guest','caregiver','contractor');
create type membership_state as enum ('invited','active','suspended','expired','left');
create type priority_level as enum ('low','normal','high','urgent');
create type task_state as enum ('not_started','accepted','in_progress','waiting','blocked','completed','verified','skipped','canceled');
create type request_state as enum ('new','seen','accepted','in_progress','waiting','completed','declined','canceled');
create type ride_state as enum ('needed','offered','assigned','confirmed','completed','canceled');
create type announcement_state as enum ('draft','scheduled','active','expired','canceled');
create type meal_response_state as enum ('home','later','away','save_plate','guest','unsure');
create type inventory_count_mode as enum ('exact','approximate');
create type inventory_level as enum ('plenty','some','low','out','unknown');
create type issue_state as enum ('reported','reviewing','monitoring','repair_planned','provider_contacted','scheduled','in_progress','resolved','closed');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_path text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null,
  created_by uuid not null references profiles(id),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invite_email citext,
  display_label text,
  role member_role not null,
  state membership_state not null default 'invited',
  permission_overrides jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(household_id,user_id)
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  address jsonb,
  timezone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  parent_id uuid references locations(id) on delete cascade,
  name text not null,
  location_type text not null,
  sort_order int not null default 0,
  unique(property_id,parent_id,name)
);

create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('google')),
  external_account_id text,
  share_mode text not null default 'full' check (share_mode in ('full','title_time','busy','private')),
  credential_ref text not null,
  sync_state jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  creator_id uuid references profiles(id),
  source text not null default 'home_v2',
  provider_connection_id uuid references calendar_connections(id) on delete set null,
  provider_calendar_id text,
  provider_event_id text,
  title text not null,
  description text,
  location_text text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day_start date,
  all_day_end date,
  timezone text,
  recurrence_rule text,
  privacy text not null default 'shared',
  status text not null default 'confirmed',
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_connection_id,provider_calendar_id,provider_event_id)
);

create table event_participants (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  attendance_status text not null default 'unknown',
  primary key(event_id,user_id)
);

create table rides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  requester_id uuid not null references profiles(id),
  driver_id uuid references profiles(id),
  pickup_text text not null,
  destination_text text not null,
  depart_by timestamptz,
  arrive_by timestamptz,
  vehicle_label text,
  state ride_state not null default 'needed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ride_passengers (
  ride_id uuid not null references rides(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key(ride_id,user_id)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  author_id uuid not null references profiles(id),
  title text not null,
  body text not null,
  priority priority_level not null default 'normal',
  state announcement_state not null default 'draft',
  response_config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table announcement_recipients (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  seen_at timestamptz,
  response jsonb,
  responded_at timestamptz,
  primary key(announcement_id,user_id)
);

create table polls (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  creator_id uuid not null references profiles(id),
  decision_owner_id uuid references profiles(id),
  question text not null,
  options jsonb not null,
  response_mode text not null default 'single',
  decision_rule text not null default 'advisory',
  closes_at timestamptz,
  closed_at timestamptz,
  final_decision jsonb,
  created_at timestamptz not null default now()
);

create table poll_responses (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  response jsonb not null,
  responded_at timestamptz not null default now(),
  primary key(poll_id,user_id)
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  source_url text,
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  default_servings numeric,
  actual_prep_minutes int,
  household_notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete set null,
  title text not null,
  meal_type text not null default 'dinner',
  planned_at timestamptz not null,
  prep_owner_id uuid references profiles(id),
  expected_servings numeric,
  status text not null default 'planned',
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table meal_responses (
  meal_id uuid not null references meals(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  response meal_response_state not null,
  guest_count int not null default 0,
  responded_at timestamptz not null default now(),
  primary key(meal_id,user_id)
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  name text not null,
  category text,
  brand text,
  count_mode inventory_count_mode not null default 'approximate',
  quantity numeric,
  unit text,
  approximate_level inventory_level,
  min_quantity numeric,
  expires_on date,
  reserved_quantity numeric not null default 0,
  preferred_store text,
  barcode text,
  notes text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  requester_id uuid not null references profiles(id),
  claimed_by uuid references profiles(id),
  name text not null,
  quantity numeric,
  unit text,
  category text,
  store text,
  preferred_brand text,
  substitutions text,
  needed_by timestamptz,
  priority priority_level not null default 'normal',
  state request_state not null default 'new',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  creator_id uuid not null references profiles(id),
  owner_id uuid references profiles(id),
  title text not null,
  description text,
  category text,
  state task_state not null default 'not_started',
  priority priority_level not null default 'normal',
  due_at timestamptz,
  recurrence_rule text,
  recurrence_template_id uuid references tasks(id),
  verification_required boolean not null default false,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table home_assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  name text not null,
  category text not null,
  manufacturer text,
  model text,
  serial_number text,
  installed_on date,
  purchased_on date,
  warranty_expires_on date,
  expected_life_years numeric,
  condition text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table maintenance_issues (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  asset_id uuid references home_assets(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  reporter_id uuid not null references profiles(id),
  owner_id uuid references profiles(id),
  title text not null,
  description text,
  urgency text not null default 'soon',
  state issue_state not null default 'reported',
  noticed_at timestamptz,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table service_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  asset_id uuid references home_assets(id) on delete set null,
  issue_id uuid references maintenance_issues(id) on delete set null,
  serviced_on date not null,
  provider_name text,
  work_performed text not null,
  diagnosis text,
  parts jsonb not null default '[]'::jsonb,
  cost numeric(12,2),
  warranty_notes text,
  follow_up_on date,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  object_type text not null,
  object_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  author_id uuid not null references profiles(id),
  object_type text not null,
  object_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  reason text not null,
  priority text not null,
  title text not null,
  body text,
  action jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  canceled_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique(dedupe_key)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  actor_user_id uuid references profiles(id),
  actor_type text not null default 'user',
  action text not null,
  object_type text not null,
  object_id uuid,
  changes jsonb,
  correlation_id text,
  created_at timestamptz not null default now()
);

create index on household_memberships(household_id,state);
create index on events(household_id,starts_at);
create index on rides(household_id,state,depart_by);
create index on meals(household_id,planned_at);
create index on tasks(household_id,owner_id,due_at,state);
create index on shopping_items(household_id,state,needed_by);
create index on inventory_items(household_id,category);
create index on maintenance_issues(household_id,state,created_at);
create index on notifications(user_id,read_at,scheduled_for);
create index on audit_events(household_id,created_at desc);

-- RLS policies must be added in migrations using a helper such as
-- is_active_household_member(household_id) and capability checks.
