create table if not exists profiles (
  user_id text primary key references "user"("id") on delete cascade,
  display_name text not null default 'Pillarpath Parent',
  phone text,
  marketing_opt_in boolean not null default false,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists children (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  name text not null,
  age integer,
  avatar text not null default 'star',
  units integer not null default 0,
  vault_units integer not null default 0,
  frozen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists children_user_id_idx on children(user_id);

create table if not exists store_products (
  id text primary key,
  name text not null,
  description text not null,
  category text not null,
  image_url text,
  unit_price integer not null,
  retail_price_cents integer not null,
  supplier_name text not null,
  supplier_sku text not null,
  active boolean not null default true,
  inventory integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists carts (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists carts_open_user_idx on carts(user_id) where status = 'open';

create table if not exists cart_items (
  id bigserial primary key,
  cart_id bigint not null references carts(id) on delete cascade,
  product_id text not null references store_products(id),
  quantity integer not null check (quantity > 0),
  unique(cart_id, product_id)
);

create table if not exists orders (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  status text not null default 'pending_payment',
  payment_provider text not null default 'stripe',
  payment_reference text,
  subtotal_cents integer not null,
  shipping_cents integer not null default 0,
  total_cents integer not null,
  shipping_name text,
  shipping_email text,
  shipping_address jsonb,
  created_at timestamptz not null default now()
);
create index if not exists orders_user_id_idx on orders(user_id);

create table if not exists order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id text not null references store_products(id),
  product_name text not null,
  supplier_name text not null,
  supplier_sku text not null,
  quantity integer not null,
  unit_price_cents integer not null
);

create table if not exists fulfillments (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  supplier_name text not null,
  supplier_order_reference text,
  status text not null default 'queued',
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fulfillments_order_id_idx on fulfillments(order_id);

create table if not exists marketing_campaigns (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  name text not null,
  channel text not null,
  status text not null default 'draft',
  budget_cents integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists campaigns_user_id_idx on marketing_campaigns(user_id);

create table if not exists promo_codes (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  code text not null,
  discount_percent integer not null,
  active boolean not null default true,
  unique(user_id, code)
);

create table if not exists referrals (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  code text not null unique,
  reward_cents integer not null default 1000,
  referrals integer not null default 0
);

insert into store_products (id,name,description,category,image_url,unit_price,retail_price_cents,supplier_name,supplier_sku,inventory)
values
('pp-backpack','Pillarpath Explorer Backpack','Durable everyday backpack for school, clubs, and adventures.','School','',22,3999,'Pillarpath Supply','PP-BAG-01',250),
('pp-art-kit','Creative Studio Art Kit','Watercolor, sketching, and craft supplies for creative projects.','Creative','',15,2499,'Pillarpath Supply','PP-ART-01',180),
('pp-science','Curious Minds Science Kit','Screen-free experiments designed for supervised family learning.','Learning','',25,3499,'Pillarpath Supply','PP-SCI-01',120),
('pp-blocks','Build-It Blocks','Open-ended building set with 120 pieces.','Play','',18,2999,'Pillarpath Supply','PP-BLK-01',160),
('pp-story-pack','Storytime Book Pack','A rotating three-book bundle for young readers.','Books','',12,2199,'Pillarpath Supply','PP-BKS-01',200),
('pp-sports-ball','Play Outside Ball','Indoor/outdoor size 3 ball for active play.','Sports','',10,1999,'Pillarpath Supply','PP-BAL-01',220)
on conflict (id) do update set name=excluded.name, description=excluded.description, retail_price_cents=excluded.retail_price_cents, active=true;
