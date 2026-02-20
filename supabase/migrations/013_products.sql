-- Products table for shop section
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  price text,
  shop_name text,
  external_url text,
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Anyone can read published products"
  on public.products for select
  using (is_published = true);

create index idx_products_sort on public.products (sort_order, created_at desc);

-- Auto-update updated_at
create trigger products_updated_at
  before update on public.products
  for each row execute function update_updated_at();
