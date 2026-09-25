-- ============================================================
-- Al Hayat Jewelry — Database schema (Next.js version)
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

create extension if not exists pgcrypto;

-- Safe to re-run: adds video_url if this schema was already applied once before.
alter table if exists products add column if not exists video_url text;

-- ---------- Tables ----------

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price integer not null check (price >= 0),
  icon text not null default 'necklace',
  description text default '',
  image_url text,
  video_url text,
  created_at timestamptz default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_name text not null,
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, variant_name)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  payment_method text not null,
  subtotal integer not null,
  delivery_fee integer not null,
  total integer not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_name text not null,
  product_name text not null,
  unit_price integer not null,
  quantity integer not null
);

-- ---------- Row Level Security ----------
-- The Next.js app never talks to Supabase from the browser — every read and
-- write goes through our own API routes, which use the SERVICE ROLE key on
-- the server. That key bypasses RLS entirely. We still enable RLS with no
-- policies as defense-in-depth: if the anon/public key ever leaked, it would
-- not be able to read or write anything directly.

alter table products enable row level security;
alter table product_variants enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
-- (no policies defined on purpose — deny-all for anon/authenticated)

-- ---------- Safe order placement (called by the server with the service role) ----------

create or replace function place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_payment_method text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal integer := 0;
  v_delivery integer := 0;
  v_total integer := 0;
  item jsonb;
  v_product products%rowtype;
  v_variant product_variants%rowtype;
  v_qty integer;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (item->>'product_id')::uuid;
    if not found then raise exception 'Product not found'; end if;

    select * into v_variant from product_variants
      where product_id = v_product.id and variant_name = (item->>'variant_name')
      for update;
    if not found then raise exception 'Colour not found for %', v_product.name; end if;

    v_qty := (item->>'quantity')::integer;
    if v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    if v_variant.stock < v_qty then
      raise exception 'Not enough stock for % (%): only % left', v_product.name, v_variant.variant_name, v_variant.stock;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  v_delivery := case when v_subtotal >= 5000 then 0 else 200 end;
  v_total := v_subtotal + v_delivery;
  v_order_number := 'AH-' || lpad(floor(random() * 900000)::text, 6, '0');

  insert into orders (order_number, customer_name, phone, address, city, payment_method, subtotal, delivery_fee, total)
  values (v_order_number, p_customer_name, p_phone, p_address, p_city, p_payment_method, v_subtotal, v_delivery, v_total)
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (item->>'product_id')::uuid;
    v_qty := (item->>'quantity')::integer;

    insert into order_items (order_id, product_id, variant_name, product_name, unit_price, quantity)
    values (v_order_id, v_product.id, (item->>'variant_name'), v_product.name, v_product.price, v_qty);

    update product_variants set stock = stock - v_qty
      where product_id = v_product.id and variant_name = (item->>'variant_name');
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'subtotal', v_subtotal, 'delivery_fee', v_delivery, 'total', v_total
  );
end;
$$;
-- No grant to anon/authenticated — only the server (service role) calls this.

-- ---------- Storage bucket for product photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 20971520, array['image/jpeg','image/png','image/webp','image/heic','image/avif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Public read is fine (product photos are meant to be public). 20MB per image — full original quality, no forced compression.
-- No insert/update/delete policy needed — uploads go through signed URLs issued by the server (service role).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-videos', 'product-videos', true, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Same reasoning: public read, 50MB per video (Supabase free-tier per-file cap), server-issued signed uploads only.

-- ---------- Starter products (safe to skip or edit) ----------
insert into products (name, category, price, icon, description) values
  ('Meherbaan Necklace Set', 'Necklace Sets', 6200, 'necklace', 'Antique-gold necklace set with hand-set kundan stones and matching drop earrings.'),
  ('Zoya Jhumka Earrings', 'Earrings', 1850, 'earring', 'Lightweight jhumka earrings with a subtle pearl drop.'),
  ('Rania Kada Bangles (Set of 2)', 'Bangles', 3100, 'bangle', 'A pair of engraved kada bangles with a matte antique finish.'),
  ('Anaya Solitaire Ring', 'Rings', 1450, 'ring', 'An adjustable statement ring set with a single cubic stone.')
on conflict do nothing;

insert into product_variants (product_id, variant_name, stock)
select id, 'Gold', 8 from products where name = 'Meherbaan Necklace Set'
union all
select id, 'Rose Gold', 3 from products where name = 'Meherbaan Necklace Set'
union all
select id, 'Gold', 10 from products where name = 'Zoya Jhumka Earrings'
union all
select id, 'Silver', 6 from products where name = 'Zoya Jhumka Earrings'
union all
select id, 'Antique Gold', 5 from products where name = 'Rania Kada Bangles (Set of 2)'
union all
select id, 'Gold', 14 from products where name = 'Anaya Solitaire Ring'
on conflict do nothing;
