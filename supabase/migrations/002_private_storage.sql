-- Supabase-only: Storage schema is provisioned by Supabase, not plain Postgres.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bagdar-materials','bagdar-materials',false,20971520,array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No browser object policies. Uploads and signed URLs are issued by the checked server API.
