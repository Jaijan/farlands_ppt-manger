create table public.email_attempts (
 id uuid primary key default gen_random_uuid(),
 delivery_id uuid not null references public.email_deliveries(id),
 attempt_number integer not null,
 status text not null,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 unique(delivery_id,attempt_number)
);
alter table public.email_attempts enable row level security;
create policy attempts_read on public.email_attempts for select to authenticated using (exists(select 1 from public.email_deliveries d where d.id=delivery_id and public.can_review(d.submission_id)));
revoke insert,update,delete on public.email_attempts from anon,authenticated;
create or replace function public.claim_delivery() returns setof public.email_deliveries language plpgsql security definer set search_path=public as $$ declare job email_deliveries; begin
 update email_deliveries set status='sending',attempt_count=attempt_count+1,started_at=now(),updated_at=now() where id=(select id from email_deliveries where status='queued' order by created_at for update skip locked limit 1) returning * into job;
 if job.id is not null then insert into email_attempts(delivery_id,attempt_number,status) values(job.id,job.attempt_count,'sending');return next job;end if;
 end $$;
create function public.log_delivery_outcome() returns trigger language plpgsql set search_path=public as $$ begin
 if new.status in ('smtp_accepted','failed','uncertain') and old.status='sending' then update email_attempts set status=new.status,finished_at=now() where delivery_id=new.id and attempt_number=new.attempt_count;end if;return new;end $$;
create trigger delivery_outcome after update on public.email_deliveries for each row execute function public.log_delivery_outcome();
