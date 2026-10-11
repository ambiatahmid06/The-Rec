-- This Supabase project does not give the API roles (anon, authenticated)
-- read/write access to new tables by default, so grant exactly what the app
-- needs. RLS policies still decide WHICH rows each user can touch.
--
-- Rule for future migrations: every new table needs explicit GRANTs like these.

-- Signed-out visitors get nothing.
revoke all on public.profiles, public.groups, public.group_members, public.group_invites from anon;

-- Signed-in users: drop the unused defaults (TRUNCATE would bypass RLS).
revoke references, trigger, truncate
  on public.profiles, public.groups, public.group_members, public.group_invites
  from authenticated;

-- Profiles: read (filtered by RLS), create and edit your own.
grant select, insert, update on public.profiles to authenticated;

-- Groups, members and invites are read-only from the app. All changes go
-- through the SECURITY DEFINER functions in the Phase 1 migration.
grant select on public.groups, public.group_members, public.group_invites to authenticated;
