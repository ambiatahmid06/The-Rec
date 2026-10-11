-- Phase 1: profiles, groups, members, invites, avatar storage.
--
-- Security model:
--   * Every table has Row Level Security on.
--   * The client can read through RLS policies, but all membership changes
--     (create group, invite, accept, kick, promote, transfer, leave) go
--     through the SECURITY DEFINER functions below, which enforce the
--     permission table in section 4 of the spec. There are no INSERT/UPDATE/
--     DELETE policies on groups, group_members or group_invites, so direct
--     writes from the client are rejected.

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  nickname text check (char_length(nickname) <= 40),
  avatar_url text,
  height_in smallint check (height_in between 36 and 108),
  weight_lb smallint check (weight_lb between 50 and 500),
  primary_position text check (primary_position in ('PG', 'SG', 'SF', 'PF', 'C')),
  secondary_position text check (secondary_position in ('PG', 'SG', 'SF', 'PF', 'C')),
  self_archetype text,
  self_strengths text[] not null default '{}',
  self_weaknesses text[] not null default '{}',
  self_scoring smallint check (self_scoring between 1 and 10),
  self_defense smallint check (self_defense between 1 and 10),
  self_playmaking smallint check (self_playmaking between 1 and 10),
  self_rebounding smallint check (self_rebounding between 1 and 10),
  self_stamina smallint check (self_stamina between 1 and 10),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'manager', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Exactly one owner per group (at most one here; the functions guarantee at least one).
create unique index group_members_one_owner on public.group_members (group_id) where role = 'owner';
create index group_members_user_id_idx on public.group_members (user_id);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  invited_user_id uuid references public.profiles (id) on delete cascade,
  invited_email text,
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (invited_user_id is not null or invited_email is not null)
);

-- No duplicate pending invites for the same person in the same group.
create unique index group_invites_pending_user
  on public.group_invites (group_id, invited_user_id)
  where status = 'pending' and invited_user_id is not null;
create unique index group_invites_pending_email
  on public.group_invites (group_id, lower(invited_email))
  where status = 'pending' and invited_email is not null;
create index group_invites_invited_user_idx on public.group_invites (invited_user_id);
create index group_invites_invited_email_idx on public.group_invites (lower(invited_email));

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

-- ============================================================
-- Helper functions (SECURITY DEFINER so RLS policies can use them
-- without policies on group_members referencing themselves)
-- ============================================================

create function public.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid())
  );
$$;

-- The caller's role in a group, or null if not a member.
create function public.group_role(p_group_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.group_members
  where group_id = p_group_id and user_id = (select auth.uid());
$$;

create function public.shares_group_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

-- The caller's email, only if confirmed. Used to match invites sent by email.
create function public.my_confirmed_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(email) from auth.users
  where id = (select auth.uid()) and email_confirmed_at is not null;
$$;

-- Raises unless the caller is signed in and has finished their profile.
create function public.require_profile()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Finish setting up your profile first.';
  end if;
  return v_uid;
end;
$$;

-- ============================================================
-- RLS policies
-- ============================================================

create policy "Read own profile or profiles of group-mates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));

create policy "Create own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members read their groups"
  on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy "Members read their group's members"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

-- Invitees read their own pending invites through my_pending_invites() instead.
create policy "Owners and managers read their group's invites"
  on public.group_invites for select to authenticated
  using (public.group_role(group_id) in ('owner', 'manager'));

-- ============================================================
-- Group functions (called from the app with supabase.rpc)
-- ============================================================

create function public.create_group(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_profile();
  v_group_id uuid;
begin
  insert into public.groups (name, owner_id)
  values (btrim(p_name), v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'owner');

  return v_group_id;
end;
$$;

create function public.rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_profile();
  if public.group_role(p_group_id) is distinct from 'owner' then
    raise exception 'Only the owner can rename the group.';
  end if;
  update public.groups set name = btrim(p_name) where id = p_group_id;
end;
$$;

create function public.delete_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_profile();
  if public.group_role(p_group_id) is distinct from 'owner' then
    raise exception 'Only the owner can delete the group.';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

-- Minimal public fields for finding someone to invite. Exact match only.
create function public.lookup_username(p_username text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where (select auth.uid()) is not null
    and p.username = lower(btrim(p_username));
$$;

create function public.invite_by_username(p_group_id uuid, p_username text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_profile();
  v_target uuid;
  v_invite_id uuid;
begin
  if coalesce(public.group_role(p_group_id), '') not in ('owner', 'manager') then
    raise exception 'Only the owner or a manager can invite players.';
  end if;

  select id into v_target from public.profiles where username = lower(btrim(p_username));
  if v_target is null then
    raise exception 'No player with that username.';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_target) then
    raise exception 'That player is already in the group.';
  end if;
  if exists (
    select 1 from public.group_invites
    where group_id = p_group_id and invited_user_id = v_target and status = 'pending'
  ) then
    raise exception 'That player already has a pending invite.';
  end if;

  insert into public.group_invites (group_id, invited_user_id, invited_by)
  values (p_group_id, v_target, v_uid)
  returning id into v_invite_id;
  return v_invite_id;
end;
$$;

create function public.invite_by_email(p_group_id uuid, p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_profile();
  v_email text := lower(btrim(p_email));
  v_invite_id uuid;
begin
  if coalesce(public.group_role(p_group_id), '') not in ('owner', 'manager') then
    raise exception 'Only the owner or a manager can invite players.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That does not look like an email address.';
  end if;
  if exists (
    select 1 from public.group_members m
    join auth.users u on u.id = m.user_id
    where m.group_id = p_group_id and lower(u.email) = v_email
  ) then
    raise exception 'That player is already in the group.';
  end if;
  if exists (
    select 1 from public.group_invites
    where group_id = p_group_id and lower(invited_email) = v_email and status = 'pending'
  ) then
    raise exception 'That email already has a pending invite.';
  end if;

  insert into public.group_invites (group_id, invited_email, invited_by)
  values (p_group_id, v_email, v_uid)
  returning id into v_invite_id;
  return v_invite_id;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  perform public.require_profile();
  select group_id into v_group_id
  from public.group_invites
  where id = p_invite_id and status = 'pending';

  if v_group_id is null then
    raise exception 'That invite is no longer pending.';
  end if;
  if coalesce(public.group_role(v_group_id), '') not in ('owner', 'manager') then
    raise exception 'Only the owner or a manager can revoke invites.';
  end if;

  update public.group_invites
  set status = 'revoked', responded_at = now()
  where id = p_invite_id;
end;
$$;

-- Pending invites addressed to me (by user id or by my confirmed email),
-- with the group name and inviter name I can't otherwise read yet.
create function public.my_pending_invites()
returns table (
  invite_id uuid,
  group_id uuid,
  group_name text,
  invited_by_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.group_id, g.name, p.display_name, i.created_at
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  left join public.profiles p on p.id = i.invited_by
  where i.status = 'pending'
    and (
      i.invited_user_id = (select auth.uid())
      or lower(i.invited_email) = public.my_confirmed_email()
    )
    and not public.is_group_member(i.group_id)
  order by i.created_at desc;
$$;

-- A group's pending invites for its owner/managers. The invitee is usually not
-- a group-mate yet, so their profile isn't readable; return just a label.
create function public.group_pending_invites(p_group_id uuid)
returns table (
  invite_id uuid,
  invited_label text,
  invited_by_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select i.id,
         coalesce('@' || target.username, i.invited_email),
         inviter.display_name,
         i.created_at
  from public.group_invites i
  left join public.profiles target on target.id = i.invited_user_id
  left join public.profiles inviter on inviter.id = i.invited_by
  where i.group_id = p_group_id
    and i.status = 'pending'
    and public.group_role(p_group_id) in ('owner', 'manager')
  order by i.created_at desc;
$$;

create function public.respond_to_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_profile();
  v_email text := public.my_confirmed_email();
  v_invite public.group_invites%rowtype;
begin
  select * into v_invite
  from public.group_invites
  where id = p_invite_id
  for update;

  if v_invite.id is null
     or not (
       coalesce(v_invite.invited_user_id = v_uid, false)
       or coalesce(lower(v_invite.invited_email) = v_email, false)
     ) then
    raise exception 'Invite not found.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'That invite is no longer pending.';
  end if;

  if p_accept then
    insert into public.group_members (group_id, user_id, role)
    values (v_invite.group_id, v_uid, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;

  -- Close this invite and any other pending invite to me for the same group.
  update public.group_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now(),
      invited_user_id = v_uid
  where group_id = v_invite.group_id
    and status = 'pending'
    and (invited_user_id = v_uid or lower(invited_email) = v_email);
end;
$$;

create function public.kick_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_profile();
  v_my_role text := public.group_role(p_group_id);
  v_target_role text;
begin
  select role into v_target_role
  from public.group_members
  where group_id = p_group_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'That player is not in the group.';
  end if;
  if p_user_id = v_uid then
    raise exception 'Use "Leave group" to remove yourself.';
  end if;
  if not (
    (v_my_role = 'owner' and v_target_role in ('manager', 'member'))
    or (v_my_role = 'manager' and v_target_role = 'member')
  ) then
    raise exception 'You do not have permission to remove that player.';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- Promote to manager or demote to member. Owner only.
create function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_target_role text;
begin
  perform public.require_profile();
  if public.group_role(p_group_id) is distinct from 'owner' then
    raise exception 'Only the owner can change roles.';
  end if;
  if p_role not in ('manager', 'member') then
    raise exception 'Role must be manager or member.';
  end if;

  select role into v_target_role
  from public.group_members
  where group_id = p_group_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'That player is not in the group.';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Use "Transfer ownership" to change the owner.';
  end if;

  update public.group_members set role = p_role
  where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- Hand the group to another member. The old owner becomes a manager.
create function public.transfer_ownership(p_group_id uuid, p_new_owner_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_profile();
begin
  if public.group_role(p_group_id) is distinct from 'owner' then
    raise exception 'Only the owner can transfer ownership.';
  end if;
  if p_new_owner_id = v_uid then
    raise exception 'You already own this group.';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = p_new_owner_id
  ) then
    raise exception 'The new owner must be a member of the group.';
  end if;

  -- Demote first so the "one owner" index is never violated.
  update public.group_members set role = 'manager'
  where group_id = p_group_id and user_id = v_uid;
  update public.group_members set role = 'owner'
  where group_id = p_group_id and user_id = p_new_owner_id;
  update public.groups set owner_id = p_new_owner_id where id = p_group_id;
end;
$$;

create function public.leave_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_profile();
  v_role text := public.group_role(p_group_id);
begin
  if v_role is null then
    raise exception 'You are not in that group.';
  end if;
  if v_role = 'owner' then
    raise exception 'Transfer ownership before leaving the group.';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = v_uid;
end;
$$;

-- Only signed-in users may call these functions.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ============================================================
-- Avatar storage: public bucket, each user writes only to their own folder
-- (avatars/<user id>/...). Images are resized in the browser before upload.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users read own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
