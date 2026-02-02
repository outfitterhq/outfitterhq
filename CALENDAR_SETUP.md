# Calendar Feature Setup

## Step 1: Run the SQL Migration

The calendar feature requires adding iOS-compatible columns to your existing `calendar_events` table. Run this SQL in your Supabase SQL Editor:

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/001_calendar_events_alter.sql`
4. Click **Run**

**Note:** This migration adds new columns to your existing table without breaking existing data. It will:
- Add `outfitter_id`, `notes`, `camp_name`, `client_email`, `guide_username`, `audience`, and `updated_at` columns
- Backfill `outfitter_id` from existing contracts/guides where possible
- Create indexes and RLS policies for the new columns

This will create:
- `calendar_events` table with proper RLS policies
- Indexes for efficient queries
- Automatic `updated_at` trigger

## Step 2: Test the Calendar

1. Start your dev server: `npm run dev`
2. Log in as an admin
3. Navigate to `/calendar`
4. Click **+ New Event** to create your first event

## Features

- ✅ Month view calendar
- ✅ Create, edit, delete events
- ✅ Assign guides to events
- ✅ Set client emails
- ✅ Set audience (Everyone, Client, Guide, Admin Only)
- ✅ Camp/location tracking
- ✅ Notes field

## API Routes

- `GET /api/calendar` - List events (supports `?start=...&end=...` query params)
- `POST /api/calendar` - Create event
- `GET /api/calendar/[id]` - Get single event
- `PUT /api/calendar/[id]` - Update event
- `DELETE /api/calendar/[id]` - Delete event

## Notes

- Events are scoped to the current outfitter (from `hc_outfitter` cookie)
- Only owners/admins can create/edit/delete events (enforced by RLS)
- All users with active memberships can view events for their outfitter
