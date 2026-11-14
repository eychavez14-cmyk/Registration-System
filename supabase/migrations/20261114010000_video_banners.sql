-- Allow GIF/video banners: add MP4/WebM to the public assets bucket and raise its file limit to 50MB (Supabase free-plan max).
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm']
where id = 'assets';
