-- 0010_m6_tasks.sql
-- M6: race-safe task claim/complete (ADR-0008, optimistic concurrency via the
-- version column added in 0004) and recurrence materialization.
--
-- Tasks carry owner_id (null = Unassigned, PRODUCT_RULES 2) and a version that
-- the 0004 bump trigger increments on every update. These RPCs guard on the
-- expected version so two people racing to claim or complete cannot both win.
--
-- Recurrence: completing a task with a recurrence_rule materializes the next
-- instance. Factored into materialize_next_task so a queue/cron worker can call
-- it directly later; for now it runs synchronously on completion.
-- Rollback at the bottom.

create or replace function public.claim_task(p_task_id uuid, p_expected_version int)
returns public.tasks language plpgsql security invoker set search_path = '' as $$
declare t public.tasks;
begin
  update public.tasks set owner_id = (select auth.uid()), state = 'accepted'
    where id = p_task_id and version = p_expected_version and owner_id is null
    returning * into t;
  if t.id is null then raise exception 'task unavailable or already claimed'; end if;
  return t;
end $$;

create or replace function public.materialize_next_task(p_task_id uuid)
returns public.tasks language plpgsql security invoker set search_path = '' as $$
declare t public.tasks; nt public.tasks; iv interval; nxt timestamptz;
begin
  select * into t from public.tasks where id = p_task_id;
  if t.id is null then raise exception 'task not found'; end if;
  if t.recurrence_rule is null or t.recurrence_rule = '' then return null; end if;
  iv := case lower(t.recurrence_rule)
          when 'daily' then interval '1 day'
          when 'weekly' then interval '7 days'
          when 'biweekly' then interval '14 days'
          when 'monthly' then interval '1 month'
          else null end;
  if iv is null then return null; end if;
  nxt := coalesce(t.due_at, now()) + iv;
  insert into public.tasks
    (household_id, creator_id, owner_id, title, description, category, state, priority, due_at, recurrence_rule, recurrence_template_id, verification_required)
  values
    (t.household_id, t.creator_id, t.owner_id, t.title, t.description, t.category, 'not_started', t.priority, nxt, t.recurrence_rule, coalesce(t.recurrence_template_id, t.id), t.verification_required)
  returning * into nt;
  return nt;
end $$;

create or replace function public.complete_task(p_task_id uuid, p_expected_version int)
returns public.tasks language plpgsql security invoker set search_path = '' as $$
declare t public.tasks;
begin
  update public.tasks set state = 'completed'
    where id = p_task_id and version = p_expected_version
      and state not in ('completed','verified','canceled','skipped')
    returning * into t;
  if t.id is null then raise exception 'task already changed or completed'; end if;
  perform public.materialize_next_task(t.id);
  return t;
end $$;

grant execute on function public.claim_task(uuid, int) to authenticated;
grant execute on function public.complete_task(uuid, int) to authenticated;
grant execute on function public.materialize_next_task(uuid) to authenticated;

-- ROLLBACK --------------------------------------------------------------------
-- drop function if exists public.complete_task(uuid, int);
-- drop function if exists public.materialize_next_task(uuid);
-- drop function if exists public.claim_task(uuid, int);
