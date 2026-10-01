-- 0007_storefront_publish.sql
--
-- Links the live shelves (`store_products`) to the screened supplier catalog
-- (`supplier_products`). Only supplier products with
-- screening_status='approved' may be published.
--
-- Also retires the six placeholder "Pillarpath Supply" seed rows from 0002:
-- they were demo stand-ins, never real curated merchandise. The shelves stay
-- empty (with an honest "stocking the shelves" state) until real products
-- are reviewed and published.

alter table store_products
  add column if not exists supplier_product_id bigint
    references supplier_products (id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists margin_pct integer;

create index if not exists store_products_supplier_product_idx
  on store_products (supplier_product_id);

-- Retire demo placeholders; keep the rows for history but hide them.
update store_products
  set active = false
  where supplier_name = 'Pillarpath Supply'
    and supplier_product_id is null;
