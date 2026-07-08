-- seed.sql
-- Real Green household demo day + a second household (Rivera) as the isolation
-- counterparty. Synthetic auth users for dev only (placeholder passwords); real
-- accounts are created through the app's auth flow. Applied to ref meinjdymzihqeajwwgkq.

-- auth users
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','bill@greenhouse.test', crypt('devpass', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}'),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','sandy@greenhouse.test', crypt('devpass', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}'),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','will@greenhouse.test', crypt('devpass', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}'),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004','authenticated','authenticated','matt@greenhouse.test', crypt('devpass', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}'),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000005','authenticated','authenticated','cora@greenhouse.test', crypt('devpass', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}'),
 ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000001','authenticated','authenticated','maria@rivera.test', crypt('devpass', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}'),
 ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000002','authenticated','authenticated','diego@rivera.test', crypt('devpass', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}');

insert into public.profiles (id, display_name, timezone) values
 ('a0000000-0000-0000-0000-000000000001','Bill','America/Chicago'),
 ('a0000000-0000-0000-0000-000000000002','Sandy','America/Chicago'),
 ('a0000000-0000-0000-0000-000000000003','Will','America/Chicago'),
 ('a0000000-0000-0000-0000-000000000004','Matt','America/Chicago'),
 ('a0000000-0000-0000-0000-000000000005','Cora','America/Chicago'),
 ('b0000000-0000-0000-0000-000000000001','Maria','America/Denver'),
 ('b0000000-0000-0000-0000-000000000002','Diego','America/Denver');

insert into public.households (id, name, timezone, created_by) values
 ('11111111-1111-1111-1111-111111111111','Green Household','America/Chicago','a0000000-0000-0000-0000-000000000001'),
 ('22222222-2222-2222-2222-222222222222','Rivera Household','America/Denver','b0000000-0000-0000-0000-000000000001');

insert into public.household_memberships (household_id, user_id, role, state) values
 ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','admin','active'),
 ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000002','adult','active'),
 ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000003','adult','active'),
 ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000004','teen','active'),
 ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000005','teen','active'),
 ('22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','admin','active'),
 ('22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000002','adult','active');

insert into public.properties (id, household_id, name, is_primary) values
 ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Green Home', true);

-- Green demo day
insert into public.events (id, household_id, creator_id, title, starts_at, ends_at) values
 ('44444444-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','Cora soccer practice',
   date_trunc('day', now()) + interval '18 hours 15 minutes', date_trunc('day', now()) + interval '19 hours 30 minutes');

insert into public.rides (id, household_id, event_id, requester_id, driver_id, pickup_text, destination_text, depart_by, arrive_by, state) values
 ('44444444-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', null,'Green Home','Eastside Soccer Complex',
   date_trunc('day', now()) + interval '17 hours 50 minutes', date_trunc('day', now()) + interval '18 hours 10 minutes','needed');

insert into public.meals (id, household_id, title, planned_at, prep_owner_id, expected_servings, created_by) values
 ('44444444-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Chicken tacos',
   date_trunc('day', now()) + interval '18 hours 15 minutes','a0000000-0000-0000-0000-000000000002', 5,'a0000000-0000-0000-0000-000000000002');
insert into public.meal_responses (meal_id, user_id, response) values
 ('44444444-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','home'),
 ('44444444-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002','home'),
 ('44444444-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','home'),
 ('44444444-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004','away');
 -- Cora's response deliberately missing (one response outstanding)

insert into public.announcements (id, household_id, author_id, title, body, priority, state, published_at) values
 ('44444444-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','Plumber today 2-4pm','Plumber coming for the kitchen sink between 2:00 and 4:00pm. Someone be home.','normal','active', now());

insert into public.tasks (id, household_id, creator_id, owner_id, title, state, due_at) values
 ('44444444-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','Take out trash tonight','not_started', date_trunc('day', now()) + interval '20 hours');

insert into public.maintenance_issues (id, household_id, reporter_id, title, urgency, state) values
 ('44444444-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','Upstairs HVAC filter overdue','soon','reported');

-- Rivera rows (isolation counterparty)
insert into public.events (id, household_id, creator_id, title, starts_at, ends_at) values
 ('55555555-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','Dentist - Diego',
   date_trunc('day', now()) + interval '9 hours', date_trunc('day', now()) + interval '10 hours');
insert into public.announcements (id, household_id, author_id, title, body, state, published_at) values
 ('55555555-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','Family meeting Sunday','Rivera family meeting Sunday night.','active', now());
insert into public.tasks (id, household_id, creator_id, owner_id, title, state) values
 ('55555555-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','Water the plants','not_started');

-- M5: Green pantry (mix of approximate + exact; three below threshold) and a shopping list.
insert into public.inventory_items (id, household_id, name, category, count_mode, quantity, unit, approximate_level, min_quantity, updated_by) values
 ('66666666-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Milk','Dairy','approximate',null,null,'low',null,'a0000000-0000-0000-0000-000000000001'),
 ('66666666-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Eggs','Dairy','exact',3,'count',null,6,'a0000000-0000-0000-0000-000000000001'),
 ('66666666-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Tortillas','Pantry','exact',12,'count',null,6,'a0000000-0000-0000-0000-000000000001'),
 ('66666666-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Coffee','Pantry','approximate',null,null,'plenty',null,'a0000000-0000-0000-0000-000000000001'),
 ('66666666-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Dish soap','Household','approximate',null,null,'out',null,'a0000000-0000-0000-0000-000000000001');

insert into public.shopping_items (id, household_id, inventory_item_id, requester_id, claimed_by, name, quantity, unit, store, state, completed_at) values
 ('77777777-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','66666666-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',null,'Milk',2,'gal','Kroger','new',null),
 ('77777777-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',null,'a0000000-0000-0000-0000-000000000002',null,'Birthday candles',null,null,null,'new',null),
 ('77777777-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',null,'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Paper towels',null,null,null,'completed',now());

-- M6: an Unassigned task (claimable) and a weekly recurring chore.
insert into public.tasks (id, household_id, creator_id, owner_id, title, state, priority, due_at, recurrence_rule) values
 ('88888888-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001',null,'Water the front garden','not_started','normal', date_trunc('day', now()) + interval '1 day 18 hours', null),
 ('88888888-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','Kitchen trash and recycling','not_started','normal', date_trunc('day', now()) + interval '20 hours', 'weekly');

-- M7: home assets and recurring maintenance schedules (one overdue, one due soon, one fine).
insert into public.home_assets (id, household_id, name, category) values
 ('aa000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Furnace (HVAC)','HVAC'),
 ('aa000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Smoke detectors','Safety'),
 ('aa000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Gutters','Exterior');

insert into public.maintenance_schedules (id, household_id, asset_id, title, cadence_days, next_due_on, created_by) values
 ('bb000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aa000000-0000-0000-0000-000000000001','Replace furnace filter',90,(now()::date - 5),'a0000000-0000-0000-0000-000000000001'),
 ('bb000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','aa000000-0000-0000-0000-000000000002','Test and replace batteries',365,(now()::date + 10),'a0000000-0000-0000-0000-000000000001'),
 ('bb000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','aa000000-0000-0000-0000-000000000003','Clean gutters',180,(now()::date + 120),'a0000000-0000-0000-0000-000000000001');
