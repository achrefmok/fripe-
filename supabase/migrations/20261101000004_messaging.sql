-- Messagerie client-boutique. Une conversation par couple client-boutique ; chaque message peut
-- citer une pièce ou une demande. Les écritures passent toutes par des RPC limitées en débit.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete cascade,
  client_name text not null,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, client_id)
);

create index conversations_client_idx on public.conversations (client_id, last_message_at desc);
create index conversations_shop_idx on public.conversations (shop_id, last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx on public.conversation_participants (user_id);

create type public.message_side as enum ('client', 'shop');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_side public.message_side not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  product_id uuid references public.products (id) on delete set null,
  stock_request_id uuid references public.stock_requests (id) on delete set null,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create type public.block_side as enum ('client', 'shop');

-- Toutes les conversations opposent un client et une boutique : le blocage suit ce couple.
create table public.user_blocks (
  client_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  blocked_by public.block_side not null,
  created_at timestamptz not null default now(),
  primary key (client_id, shop_id, blocked_by)
);

create function private.is_blocked(p_client uuid, p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b where b.client_id = p_client and b.shop_id = p_shop
  );
$$;

revoke all on function private.is_blocked(uuid, uuid) from public;

create function private.insert_message(
  p_conversation_id uuid,
  p_side public.message_side,
  p_body text,
  p_product_id uuid,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_message uuid;
begin
  perform private.enforce_rate_limit('send_message', 60, 3600);

  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'message_invalid';
  end if;

  insert into public.messages (
    conversation_id, sender_id, sender_side, body, product_id, stock_request_id
  )
  values (p_conversation_id, v_user, p_side, btrim(p_body), p_product_id, p_request_id)
  returning id into v_message;

  update public.conversations c set last_message_at = now() where c.id = p_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (p_conversation_id, v_user)
  on conflict (conversation_id, user_id) do update set last_read_at = now();

  return v_message;
end;
$$;

revoke all on function private.insert_message(uuid, public.message_side, text, uuid, uuid) from public;

create function public.start_conversation(
  p_shop_id uuid,
  p_product_id uuid,
  p_request_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text;
  v_conversation public.conversations%rowtype;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.shops s where s.id = p_shop_id and s.status = 'approved') then
    raise exception 'not_found';
  end if;

  if p_shop_id in (select private.my_shop_ids()) then
    raise exception 'own_shop';
  end if;

  if private.is_blocked(v_user, p_shop_id) then
    raise exception 'blocked';
  end if;

  if p_product_id is not null and not exists (
    select 1 from public.products p where p.id = p_product_id and p.shop_id = p_shop_id
  ) then
    raise exception 'not_found';
  end if;

  if p_request_id is not null and not exists (
    select 1 from public.stock_requests r
    where r.id = p_request_id and r.shop_id = p_shop_id and r.client_id = v_user
  ) then
    raise exception 'not_found';
  end if;

  select * into v_conversation
  from public.conversations c
  where c.shop_id = p_shop_id and c.client_id = v_user
  for update;

  if v_conversation.id is null then
    perform private.enforce_rate_limit('start_conversation', 10, 86400);

    select p.display_name into v_name from public.profiles p where p.id = v_user;

    insert into public.conversations (shop_id, client_id, client_name)
    values (p_shop_id, v_user, v_name)
    returning * into v_conversation;
  end if;

  if v_conversation.closed_at is not null then
    raise exception 'conversation_closed';
  end if;

  perform private.insert_message(v_conversation.id, 'client', p_body, p_product_id, p_request_id);

  return v_conversation.id;
end;
$$;

-- Le vendeur peut ouvrir la discussion à partir d'une demande reçue.
create function public.contact_request_client(p_request_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.stock_requests%rowtype;
  v_conversation public.conversations%rowtype;
begin
  select * into v_request from public.stock_requests r where r.id = p_request_id;

  if v_request.id is null or v_request.shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if private.is_blocked(v_request.client_id, v_request.shop_id) then
    raise exception 'blocked';
  end if;

  insert into public.conversations (shop_id, client_id, client_name)
  values (v_request.shop_id, v_request.client_id, v_request.client_name)
  on conflict (shop_id, client_id) do update set client_name = excluded.client_name
  returning * into v_conversation;

  if v_conversation.closed_at is not null then
    raise exception 'conversation_closed';
  end if;

  perform private.insert_message(v_conversation.id, 'shop', p_body, null, p_request_id);

  return v_conversation.id;
end;
$$;

create function public.send_message(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_side public.message_side;
begin
  select * into v_conversation from public.conversations c where c.id = p_conversation_id;

  if v_conversation.id is null or not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  if v_conversation.client_id = (select auth.uid()) then
    v_side := 'client';
  elsif v_conversation.shop_id in (select private.my_writable_shop_ids()) then
    v_side := 'shop';
  else
    raise exception 'forbidden';
  end if;

  if v_conversation.closed_at is not null then
    raise exception 'conversation_closed';
  end if;

  if private.is_blocked(v_conversation.client_id, v_conversation.shop_id) then
    raise exception 'blocked';
  end if;

  return private.insert_message(p_conversation_id, v_side, p_body, null, null);
end;
$$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.client_id = (select auth.uid()) or c.shop_id in (select private.my_shop_ids()))
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (p_conversation_id, (select auth.uid()))
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

create function public.my_conversations()
returns table (
  id uuid,
  shop_id uuid,
  shop_name text,
  client_id uuid,
  client_name text,
  last_message_at timestamptz,
  last_body text,
  closed_at timestamptz,
  unread bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.shop_id, s.name, c.client_id, c.client_name, c.last_message_at,
    (select m.body from public.messages m
     where m.conversation_id = c.id order by m.created_at desc limit 1),
    c.closed_at,
    (select count(*) from public.messages m
     where m.conversation_id = c.id
       and m.sender_id is distinct from (select auth.uid())
       and m.created_at > coalesce(
         (select p.last_read_at from public.conversation_participants p
          where p.conversation_id = c.id and p.user_id = (select auth.uid())),
         '-infinity'
       ))
  from public.conversations c
  join public.shops s on s.id = c.shop_id
  where c.client_id = (select auth.uid()) or c.shop_id in (select private.my_shop_ids())
  order by c.last_message_at desc
  limit 100;
$$;

create function public.block_conversation(p_conversation_id uuid, p_block boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_side public.block_side;
begin
  select * into v_conversation from public.conversations c where c.id = p_conversation_id;

  if v_conversation.id is null then
    raise exception 'forbidden';
  end if;

  if v_conversation.client_id = (select auth.uid()) then
    v_side := 'client';
  elsif v_conversation.shop_id in (select private.my_writable_shop_ids()) then
    v_side := 'shop';
  else
    raise exception 'forbidden';
  end if;

  if p_block then
    insert into public.user_blocks (client_id, shop_id, blocked_by)
    values (v_conversation.client_id, v_conversation.shop_id, v_side)
    on conflict do nothing;
  else
    delete from public.user_blocks b
    where b.client_id = v_conversation.client_id
      and b.shop_id = v_conversation.shop_id
      and b.blocked_by = v_side;
  end if;
end;
$$;

revoke all on function public.start_conversation(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.contact_request_client(uuid, text) from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.my_conversations() from public, anon;
revoke all on function public.block_conversation(uuid, boolean) from public, anon;

grant execute on function public.start_conversation(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.contact_request_client(uuid, text) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.block_conversation(uuid, boolean) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;

revoke all on public.conversations, public.conversation_participants, public.messages,
  public.user_blocks from anon, authenticated;

grant select on public.conversations, public.conversation_participants, public.messages,
  public.user_blocks to authenticated;

-- Les administrateurs n'ont volontairement aucun accès direct : ils ne voient que l'extrait
-- figé dans un signalement.
create policy conversations_select_participants on public.conversations
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
  );

create policy conversation_participants_select_own on public.conversation_participants
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy messages_select_participants on public.messages
  for select to authenticated
  using (conversation_id in (select c.id from public.conversations c));

create policy user_blocks_select_parties on public.user_blocks
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
  );

alter publication supabase_realtime add table public.messages;
