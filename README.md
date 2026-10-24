# pulse

A personal training, sleep and recovery dashboard for one athlete, built as an iPhone
home-screen app (PWA). It brings together what usually lives in four places (Garmin
Connect, COROS, Strava, intervals.icu) and shows it in an iOS Weather–style interface.

Single user, one password. No accounts, no tracking.

## What's in it

| Tab          | Shows                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**    | Readiness (Ready / Go easy / Rest) from HRV, resting HR, sleep and form; this week's volume by sport; today's workout; the last 7 nights of HRV against your normal                                 |
| **Training** | Fitness and form over 6 months, 52 weeks of volume, time in power and heart-rate zones, activities with route maps, laps and zones                                                                  |
| **Health**   | Sleep against your need, HRV and resting HR against your normal, stress, weight, night tags (alcohol, illness, …) kept out of your baseline                                                         |
| **Races**    | Your level against other athletes (with silly names and the real grade behind them), PB vs now for run times and ride power, badges, a long-ride time estimate from a GPX file, swim critical speed |
| **Outlook**  | Races ahead, running potential per distance (now, race day, PB, COROS), the plan, a fitness what-if, power vs fitness                                                                               |

Explanations live behind the ⓘ on each card.

## Where the data comes from

- **intervals.icu** — the main store: every activity (Garmin, COROS, MyWhoosh and a one-off
  Strava archive upload), fitness/fatigue, planned workouts and races.
- **COROS official MCP server** — sleep, overnight HRV, stress and sleeping heart rate, pulled
  daily (OAuth with PKCE). HRV, sleep and resting HR are written back to intervals.icu so other
  tools see them too.
- **Neon Postgres** — the COROS connection, nightly values, night tags and a small log.

## How the numbers are made

Every model is documented in its source file, with the method and its limits:

- **Readiness** (`src/lib/readiness.ts`): 7-night mean of ln(rMSSD) against a 60-day normal
  (± 0.5 SD), after Plews et al. 2013 and Javaloyes et al. 2019; resting HR, sleep and form only
  flag. A traffic light, never a 0–100 score.
- **Resting HR**: the lowest heart rate of each night's sleep. COROS's official data has no
  minute-level series, so an exact lowest-30-minute average isn't possible.
- **Running potential** (`src/lib/potential.ts`): fitness from heart rate against pace
  (Runalyze's open-source method), calibrated to your best performances; race-day estimates from
  Tanda 2011's volume effect anchored to the volume you ran when you were fittest. Shown as ranges.
- **Level** (`src/lib/level.ts`): WMA/USATF 2025 age grading for running, Coggan's power profile
  for riding.
- **Outlook** (`src/lib/outlook.ts`): Banister fitness/fatigue with intervals.icu's constants;
  power vs fitness fitted on your own history. Each was back-tested against "no change" before it
  was shown; ranges are the 80th percentile of past errors.
- **VO₂max, critical speed, swim CSS, long-ride physics** (`src/lib/races.ts`): Daniels VDOT,
  Hawley & Noakes, critical-speed fits with validity checks, and a steady-power physics model.

## Stack

Next.js 16 (App Router), React 19, TypeScript, plain CSS, Drizzle ORM on Neon Postgres,
MapLibre GL with OpenFreeMap tiles, Vercel (Frankfurt). Biome for lint and format, Vitest for
tests.

## Running it

```sh
pnpm install
cp .env.example .env.local   # fill in the values below
pnpm db:migrate
pnpm dev
```

| Variable                                            | What it is                                                 |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`                                      | Neon pooled URL (the Vercel Neon integration sets it)      |
| `APP_PASSWORD`                                      | The one login password                                     |
| `SESSION_SECRET`                                    | Signs the session cookie (`openssl rand -base64 32`)       |
| `INTERVALS_ICU_API_KEY`, `INTERVALS_ICU_ATHLETE_ID` | intervals.icu → Settings → Developer                       |
| `CRON_SECRET`                                       | Vercel sends it to the daily sync (`openssl rand -hex 24`) |

For a local database, `npx @electric-sql/pglite-socket --port=5433` with `DB_POOL_MAX=1` works.

After deploying, log in and tap **Connect COROS** on Today once. A Vercel cron runs the sync daily
at 09:00 UTC, and opening the app pulls last night if it's missing.

```sh
pnpm test     # vitest
pnpm lint     # biome
pnpm build    # also copies MapLibre's worker into public/
```

## Privacy

This repository holds code only. Health data stays in Neon and intervals.icu; secrets live in
Vercel's environment variables. Test fixtures use made-up values.
