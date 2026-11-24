-- ============================================================================
-- FIX: "Unauthorized collector" when registering a transaction
--
-- Why it happened: the Netlify function calls this RPC with the SERVICE ROLE
-- client. Service-role requests carry no end-user JWT, so inside the function
-- auth.uid() is NULL and the profile lookup always returned nothing.
--
-- Fix: the trusted server function now passes the collector's profile id
-- (derived from the verified access token). Execute is restricted to
-- service_role so browsers cannot call the RPC directly and impersonate
-- another collector.
-- ============================================================================

create or replace function public.create_livestock_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_collector uuid;
  v_id uuid;
  v_seq bigint;
  v_receipt text;
  v_prefix text;
  v_year text := to_char(current_date,'YYYY');
begin
  -- Preferred path: the server function already verified the access token and
  -- supplies the acting profile id. Ignored whenever a real user JWT is present,
  -- so a browser can never impersonate another collector.
  if auth.uid() is null and coalesce(p_payload->>'collector_id','') <> '' then
    select id into v_collector
      from public.profiles
     where id = (p_payload->>'collector_id')::uuid
       and is_active
     limit 1;

    if v_collector is null then
      raise exception 'Invalid or inactive collector' using errcode='22023';
    end if;
  else
    -- Fallback for direct user-JWT calls (kept for local/manual testing).
    select id into v_collector
      from public.profiles
     where auth_user_id = auth.uid()
       and is_active
     limit 1;

    if v_collector is null then
      raise exception 'Unauthorized collector' using errcode='42501';
    end if;
  end if;

  select coalesce(receipt_prefix,'LVM') into v_prefix from public.market_settings where id=1;
  v_seq := nextval('public.transaction_sequence');
  v_receipt := v_prefix || '-' || v_year || '-' || lpad(v_seq::text,6,'0');

  insert into public.transactions(
    receipt_number,sequence_number,transaction_date,transaction_time,animal_type,animal_sex,
    animal_colour,animal_age,animal_description,seller_name,seller_phone,seller_address,seller_village,seller_photo_path,
    buyer_name,buyer_phone,buyer_address,buyer_village,buyer_photo_path,middleman_id,collector_id
  ) values (
    v_receipt,v_seq,(p_payload->>'transaction_date')::date,(p_payload->>'transaction_time')::time,
    (p_payload->>'animal_type')::animal_type,(coalesce(p_payload->>'animal_sex','unknown'))::animal_sex,
    p_payload->>'animal_colour',p_payload->>'animal_age',p_payload->>'animal_description',
    p_payload->>'seller_name',p_payload->>'seller_phone',p_payload->>'seller_address',p_payload->>'seller_village',p_payload->>'seller_photo_path',
    p_payload->>'buyer_name',p_payload->>'buyer_phone',p_payload->>'buyer_address',p_payload->>'buyer_village',p_payload->>'buyer_photo_path',
    nullif(p_payload->>'middleman_id','')::uuid,v_collector
  ) returning id into v_id;

  insert into public.animal_identifications(transaction_id,left_side_image_path,right_side_image_path,left_side_description,right_side_description)
  values(v_id,p_payload->>'left_side_image_path',p_payload->>'right_side_image_path',p_payload->>'left_side_description',p_payload->>'right_side_description');

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_values)
  values(v_collector,'TRANSACTION_CREATED','transaction',v_id,p_payload || jsonb_build_object('receipt_number',v_receipt));

  return jsonb_build_object('id',v_id,'receipt_number',v_receipt,'sequence_number',v_seq);
end;
$$;

revoke all on function public.create_livestock_transaction(jsonb) from public;
revoke all on function public.create_livestock_transaction(jsonb) from anon;
revoke all on function public.create_livestock_transaction(jsonb) from authenticated;
grant execute on function public.create_livestock_transaction(jsonb) to service_role;
