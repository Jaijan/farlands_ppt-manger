-- Keep idempotency keys separate from immutable published feedback.
 alter function public.save_review(uuid,uuid,jsonb,boolean) rename to save_review_impl;
create table public.publication_requests(request_id uuid primary key,feedback_id uuid not null references public.feedback(id));
alter table public.publication_requests enable row level security;
-- Replace lookup with request ledger (published rows remain entirely immutable).
create or replace function public.save_review(sid uuid,actor uuid,body jsonb,publish boolean) returns uuid language plpgsql security definer set search_path=public as $$ declare result uuid; begin
 perform 1 from submissions where id=sid for update;
 if not exists(select 1 from profiles p join judge_assignments a on a.judge_id=p.id where p.id=actor and p.is_active and p.role='judge' and a.submission_id=sid and a.status='active') then raise exception 'Not authorized'; end if;
 if publish then select f.id into result from publication_requests r join feedback f on f.id=r.feedback_id where r.request_id=(body->>'request_id')::uuid and f.judge_id=actor and f.submission_id=sid; if result is not null then return result; end if; end if;
 result:=save_review_impl(sid,actor,body,publish);
 if publish then insert into publication_requests(request_id,feedback_id) values((body->>'request_id')::uuid,result); end if; return result; end $$;
revoke execute on function public.save_review(uuid,uuid,jsonb,boolean),public.save_review_impl(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_review(uuid,uuid,jsonb,boolean) to service_role;
create function public.register_submission(body jsonb,token_hash text) returns void language plpgsql security definer set search_path=public as $$ begin
 if exists(select 1 from settings where submission_deadline<now()) then raise exception 'Submissions closed'; end if;
 insert into submissions(id,reference_code,team_name,team_id,institution,leader_name,leader_email,contact_number,project_title,abstract,original_file_path,original_file_name,file_mime_type,file_size,preview_file_path,preview_status) values((body->>'id')::uuid,body->>'reference_code',body->>'team_name',body->>'team_id',body->>'institution',body->>'leader_name',body->>'leader_email',body->>'contact_number',body->>'project_title',body->>'abstract',body->>'original_file_path',body->>'original_file_name',body->>'file_mime_type',(body->>'file_size')::bigint,body->>'preview_file_path',body->>'preview_status');
 insert into verification_tokens(submission_id,token_hash,expires_at) values((body->>'id')::uuid,token_hash,now()+interval '7 days');
 insert into email_deliveries(submission_id,recipient_email,message_type) values((body->>'id')::uuid,body->>'leader_email','confirmation'); end $$;
revoke execute on function public.register_submission(jsonb,text) from public,anon,authenticated;
grant execute on function public.register_submission(jsonb,text) to service_role;
