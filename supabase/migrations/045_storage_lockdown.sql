-- Migration 045: Storage lock-down.
--
-- Migration 003 let any signed-in user upload any file to both public buckets directly
-- through the Storage API, and let anyone holding the API key list every object. All
-- uploads go through the API or the admin panel with the service role, which bypasses
-- these policies, so they only served abuse. Public buckets keep serving files by URL
-- without any policy.
-- Also cap object size and restrict content types at the bucket level, so the limits hold
-- even if an application check is bypassed.

begin;

drop policy if exists "Trail media is publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload trail media" on storage.objects;
drop policy if exists "Proof photos are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload proof photos" on storage.objects;

update storage.buckets
set file_size_limit = 12 * 1024 * 1024,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime'
    ]
where id in ('trail-media', 'proof-photos');

insert into public.schema_migrations (version, description)
values ('045', 'storage_lockdown')
on conflict (version) do nothing;

commit;
