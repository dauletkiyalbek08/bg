-- Bagdar 0.1: private server-owned document store.
-- Authenticated browsers never receive service credentials or access this table.
create table if not exists public.bagdar_records (
  kind text not null check (kind in ('users','organizations','classes','questions','careers','surveys','assignments','attempts','trainings','comments','favorites','sessions','audit','imports','materials','feedback')),
  id text not null,
  data jsonb not null check(jsonb_typeof(data)='object' and data->>'id'=id),
  revision bigint not null default 1 check(revision>0),
  org_id text generated always as (data->>'org') stored,
  org_kind text generated always as (case when data->>'org' is not null then 'organizations' end) stored,
  primary key(kind,id),
  foreign key(org_kind,org_id) references public.bagdar_records(kind,id) deferrable initially deferred,
  check (kind not in ('classes','surveys','assignments','attempts','trainings','comments','favorites','imports','materials','feedback') or data->>'org' is not null),
  check (kind not in ('questions','careers') or (not (data ? 'org') or jsonb_typeof(data->'org') in ('string','null')))
);
create index if not exists bagdar_org_kind on public.bagdar_records(org_id,kind);
create unique index if not exists bagdar_login on public.bagdar_records(lower(data->>'login')) where kind='users';
create unique index if not exists bagdar_active_attempt on public.bagdar_records((data->>'owner'),(data->>'assignmentId')) where kind='attempts' and data->>'status'='active';
alter table public.bagdar_records enable row level security;
alter table public.bagdar_records force row level security;
-- No anon/authenticated policies by design. All reads go through the checked API.
revoke all on public.bagdar_records from public,anon,authenticated;
grant select,insert,update,delete on public.bagdar_records to service_role;

create or replace function public.bagdar_validate_reference() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare target jsonb;
begin
  if new.data->>'classId' is not null then
    select data into target from public.bagdar_records where kind='classes' and id=new.data->>'classId';
    if target is null or target->>'org' is distinct from new.data->>'org' then raise exception 'class organization mismatch'; end if;
  end if;
  if new.data->>'owner' is not null then
    select data into target from public.bagdar_records where kind='users' and id=new.data->>'owner';
    if target is null or target->>'org' is distinct from new.data->>'org' then raise exception 'owner organization mismatch'; end if;
  end if;
  if new.kind='attempts' then
    select data into target from public.bagdar_records where kind='assignments' and id=new.data->>'assignmentId';
    if target is null or target->>'org' is distinct from new.data->>'org' then raise exception 'assignment organization mismatch'; end if;
  end if;
  return new;
end $$;
create constraint trigger bagdar_check_reference after insert or update on public.bagdar_records
  deferrable initially deferred for each row execute function public.bagdar_validate_reference();

create or replace function public.bagdar_commit(writes jsonb) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare w jsonb; current_revision bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  if jsonb_typeof(writes)<>'array' or jsonb_array_length(writes)>5000 then raise exception 'invalid batch'; end if;
  perform pg_advisory_xact_lock(hashtext('bagdar_commit'));
  for w in select value from jsonb_array_elements(writes) loop
    select revision into current_revision from public.bagdar_records where kind=w->>'kind' and id=w->>'id' for update;
    if coalesce(current_revision,0)<>(w->>'expected')::bigint then raise exception 'conflict'; end if;
    if w->'data'='null'::jsonb then
      delete from public.bagdar_records where kind=w->>'kind' and id=w->>'id';
    else
      insert into public.bagdar_records(kind,id,data,revision)
      values(w->>'kind',w->>'id',w->'data',(w->>'expected')::bigint+1)
      on conflict(kind,id) do update set data=excluded.data,revision=excluded.revision;
    end if;
  end loop;
end $$;
revoke all on function public.bagdar_commit(jsonb) from public,anon,authenticated;
grant execute on function public.bagdar_commit(jsonb) to service_role;
