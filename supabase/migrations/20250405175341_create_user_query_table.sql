create table queries (
  user_id uuid default gen_random_uuid() primary key,
  user_name text,
  user_prompt text,
  created_at timestamp default now()
);