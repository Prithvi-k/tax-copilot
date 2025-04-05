create table uploaded_files (
  id uuid primary key default gen_random_uuid(),
  filename text,
  upload_time timestamp default now(),
  filesize bigint,
  status text
);
