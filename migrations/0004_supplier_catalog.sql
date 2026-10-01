-- 0004_supplier_catalog.sql
--
-- Supplier catalog ingestion + AI kid-safety screening.
--
-- Pipeline: supplier catalog (CJ Dropshipping, later Printify/Spocket) is
-- imported into `supplier_products`, every row passes through the screening
-- service (src/lib/suppliers/screening.ts), and only `approved` rows are
-- eligible for the storefront. Ambiguous rows land in `quarantined` for a
-- human reviewer; `rejected` rows never ship.
--
-- `supplier_orders` links PillarPath orders to the supplier's fulfillment
-- orders for tracking/status sync.

create table if not exists supplier_products (
  id bigserial primary key,
  supplier text not null default 'cjdropshipping',
  supplier_product_id text not null,
  supplier_sku text,
  title text not null,
  description text,
  images jsonb not null default '[]',
  cost_cents integer,
  currency text not null default 'USD',
  category_id text,
  category_name text,
  variants jsonb not null default '[]',
  warehouse_country text,
  ship_from_country text,
  inventory integer,
  -- Compliance signals gathered at import time: CPC/CPSIA/ASTM mentions,
  -- sample ordered, etc. Informational; screening interprets them.
  compliance jsonb not null default '{}',
  screening_status text not null default 'pending'
    check (screening_status in ('pending', 'approved', 'quarantined', 'rejected')),
  screening_reasons jsonb not null default '[]',
  screening_provider text,
  screened_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier, supplier_product_id)
);

create index if not exists supplier_products_status_idx
  on supplier_products(screening_status);
create index if not exists supplier_products_supplier_sku_idx
  on supplier_products(supplier, supplier_sku);

create table if not exists supplier_orders (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  supplier text not null default 'cjdropshipping',
  supplier_order_id text,
  supplier_order_number text,
  status text not null default 'pending',
  tracking_number text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier, supplier_order_id)
);

create index if not exists supplier_orders_order_idx
  on supplier_orders(order_id);
