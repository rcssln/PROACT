# Supabase Setup Guide

This report system uses Supabase (PostgreSQL) for storing evacuation reports.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project
3. Wait for the database to be provisioned

## 2. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `supabase/schema.sql` from this project
3. Copy the contents and run it in the SQL Editor
4. This creates the `reports` and `report_rows` tables

## 3. Get Your API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the **Project URL**
3. Copy the **anon public** key (under Project API keys)

## 4. Configure Environment Variables

1. Create a `.env` file in the project root (copy from `.env.example`)
2. Add your credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Restart the dev server: `npm run dev`

## Database Schema

- **reports**: Stores each report submission (id, submitted_at)
- **report_rows**: Stores evacuation data per barangay (linked to reports via report_id)

Reports are fetched on page load and saved when you submit the Add Report form.
