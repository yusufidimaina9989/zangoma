-- ============================================================================
-- OPTIONAL: create the first administrator entirely in SQL
--
-- Use this only if `npm run admin:create` is not available to you.
-- It is idempotent: if the email already exists it reuses that auth user and
-- just repairs the public.profiles row.
--
-- BEFORE RUNNING: change the password below. Plaintext credentials in a file
-- are for local development only — never commit real production passwords.
-- ============================================================================

do $$
declare
  v_user_id uuid;
  v_email   text := 'admin@market.local';
  v_password text := 'ChangeMe123';
  v_name    text := 'Market Administrator';
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email) limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      now(),
      now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      now(), now(), now()
    );
  else
    -- Repair the password in case an earlier attempt created the user only.
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_user_id;
  end if;

  insert into public.profiles (auth_user_id, full_name, role, is_active)
  values (v_user_id, v_name, 'admin', true)
  on conflict (auth_user_id) do update
    set role = 'admin', is_active = true, full_name = excluded.full_name, updated_at = now();

  raise notice 'Administrator ready: % (auth user %)', v_email, v_user_id;
end $$;

-- Verify:
select u.email, p.full_name, p.role, p.is_active
from auth.users u
join public.profiles p on p.auth_user_id = u.id
where lower(u.email) = lower('admin@market.local');
