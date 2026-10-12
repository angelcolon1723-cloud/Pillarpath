-- 0027_teacher_verification_align.sql — READY TO APPLY (prepared 2026-10-10)
-- Source diagnosis: files/teacher-verification-schema-fix.md in this goal.
-- Aligns the live teacher_verifications table (created by 0005 with
-- user_id / school_email / evidence_url / status in pending|approved|rejected)
-- with the schema the app code actually uses (school / district /
-- work_email / notes / status 'verified').
--
-- BEFORE RUNNING on prod: confirm the auto-generated name of the 0005
-- status CHECK on teacher_verifications (expected:
-- teacher_verifications_status_check) via pg_constraint. The DROP IF EXISTS
-- below is safe either way; if the real name differs, drop that name instead.
-- The "user" constraint WAS named explicitly in 0005:
-- user_teacher_status_check.

alter table teacher_verifications
  add column if not exists school text not null default '',
  add column if not exists district text not null default '',
  add column if not exists work_email text not null default '',
  add column if not exists notes text not null default '';

update teacher_verifications
  set work_email = coalesce(nullif(work_email, ''), school_email, ''),
      notes = coalesce(nullif(notes, ''), evidence_url, '')
  where coalesce(school_email, '') <> '' or coalesce(evidence_url, '') <> '';

update teacher_verifications set status = 'verified' where status = 'approved';
update "user" set teacher_status = 'verified' where teacher_status = 'approved';

alter table teacher_verifications
  drop constraint if exists teacher_verifications_status_check;
alter table teacher_verifications
  add constraint teacher_verifications_status_check
  check (status in ('pending', 'verified', 'rejected'));

alter table "user" drop constraint if exists user_teacher_status_check;
alter table "user"
  add constraint user_teacher_status_check
  check (teacher_status in ('unverified', 'pending', 'verified', 'rejected'));

-- Companion code patches (see teacher-verification-schema-fix.md §2–3):
-- 1. src/lib/teacher-server.ts requestTeacherVerification:
--    teacher_id -> user_id in the existing-row select, insert column list,
--    and on conflict (user_id).
-- 2. src/lib/society-server.ts reviewTeacherVerification:
--    where teacher_id = ... -> where user_id = ...
--    (returning school works once this migration adds the column).
-- 3. Optional: listTeacherVerifications reads the new columns with
--    coalesce fallback to school_email / evidence_url.
