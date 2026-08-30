-- Fix: 0001 renamed auth_user_id → password_hash but left the column as uuid.
ALTER TABLE "users" ALTER COLUMN "password_hash" TYPE text;
