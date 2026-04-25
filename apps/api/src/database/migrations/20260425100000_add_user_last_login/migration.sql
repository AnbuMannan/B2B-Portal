-- Add lastLoginAt to User for "New Leads Only" filter (leads since seller's last login)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
