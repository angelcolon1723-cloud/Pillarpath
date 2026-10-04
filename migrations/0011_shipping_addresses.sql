-- 0011: Shipping addresses for physical fulfillment.
--
-- When a parent approves a kid's marketplace purchase (paid in Units),
-- the product ships to the family's address via CJ Dropshipping.
-- The address is captured once and reused for future orders.

create table if not exists shipping_addresses (
  id uuid primary key,
  user_id text not null references "user"("id") on delete cascade,
  recipient_name text not null,
  street text not null,
  city text not null,
  state text not null,
  zip text not null,
  country text not null default 'US',
  phone text not null default '',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipping_addresses_user_idx on shipping_addresses(user_id);
