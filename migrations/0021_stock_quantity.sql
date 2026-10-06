-- Stock quantities for storefront products.
-- Lets King set how many units of each product are available in the store.
-- Product cards show "X in stock"; stock decrements on purchase.

alter table store_products
  add column if not exists stock_quantity integer not null default 50;

-- Index for low-stock alerts.
create index if not exists store_products_stock_idx
  on store_products (stock_quantity) where active = true;
