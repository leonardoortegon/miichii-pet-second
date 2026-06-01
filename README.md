# Miichii Pet

A Vite + React + TypeScript MVP for a pixel-style virtual pet game inspired by 90s handheld devices. Users authenticate with Supabase, create pets, care for them, and return later to see deterministic offline simulation results.

## Stack

- Vite + React + TypeScript
- Supabase Auth, Postgres, RLS, and Edge Functions
- TanStack Query for server state
- Zustand for local selected-pet state
- CSS pixel-art handheld UI

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
cp .env.example .env.local
```

3. Fill in your Supabase project values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Apply the migration in `supabase/migrations/0001_miichii_mvp.sql` to your Supabase database.

5. Run the app:

```bash
npm run dev
```

## Supabase Notes

The migration creates the MVP tables:

- `profiles`
- `pets`
- `pet_events`
- `pet_memories`
- `environments`
- `environment_objects`
- `inventory_items`
- `user_actions`
- `simulation_runs`
- `ai_generated_events`

Every user-owned table includes `user_id` and has Row Level Security policies so authenticated users can only access their own records.

## AI Boundary

The app does not let AI directly write to the database. The simulation engine in `src/lib/simulation.ts` owns stat updates and validation. The placeholder Edge Function at `supabase/functions/generate-ai-event` returns structured mock JSON for future AI events, memories, trait changes, and stat changes. AI output should be validated before anything is saved.

## Verification

```bash
npm run lint
npm run build
```
