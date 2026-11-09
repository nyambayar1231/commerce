-- Custom SQL migration file, put your code below! --
-- citext gives us case-insensitive text for user.email (unique regardless of case, ARCHITECTURE.md §3).
CREATE EXTENSION IF NOT EXISTS citext;
