# Car Tracking Dashboard v1

Internal Next.js dashboard for live fleet location, vehicle history, trip inference, and CSV trip exports from `vehicle_tracking_data_v3`.

## Features

- Live multi-vehicle map with latest known location per plate.
- Vehicle timeline and route replay for a selected period.
- Trip report generation with KPI set:
  - Distance
  - Duration
  - Idle
  - Avg speed
  - Max speed
- Route snapping with OSRM (`OSRM_BASE_URL`), with fallback to raw route if unavailable.
- CSV export for filtered trip reports.

## Environment

Create `.env` from `.env.example` and provide your credentials.

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL`
- `OSRM_BASE_URL` (default provided)
- `AUTH_APP_BASE_URL`
- `AUTH_SESSION_SECRET`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_AUTHORIZATION_URL`
- `OIDC_TOKEN_URL`
- `OIDC_USERINFO_URL`
- `LOCAL_AUTH_USERNAME`
- `LOCAL_AUTH_PASSWORD`

For local `npm run dev` outside Docker, if OSRM is running via compose on host port `8549`, set:

- `OSRM_BASE_URL=http://localhost:8549`

Optional tuning:

- `POLL_INTERVAL_SEC`
- `NEXT_PUBLIC_POLL_INTERVAL_SEC`
- `TRIP_MOVE_DISTANCE_M`
- `TRIP_MOVE_SPEED_KMH`
- `TRIP_STOP_MINUTES`
- `NEXT_PUBLIC_OSM_TILE_URL`
- `AUTH_SESSION_TTL_SEC`
- `OIDC_END_SESSION_URL`
- `OIDC_SCOPE`
- `OIDC_REDIRECT_PATH`
- `LOCAL_AUTH_DISPLAY_NAME`

## Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## OAuth2 / OpenID Connect Setup (Authentik Example)

The app uses OAuth2 Authorization Code flow with PKCE and signed HttpOnly session cookies.

### 1) Create provider/app in Authentik

In Authentik, create an OAuth2/OpenID Provider + Application and capture:

- Client ID
- Client Secret
- Authorization endpoint URL
- Token endpoint URL
- UserInfo endpoint URL
- End session URL (optional)

Typical Authentik endpoint patterns:

- Authorization: `https://<authentik-host>/application/o/authorize/`
- Token: `https://<authentik-host>/application/o/token/`
- UserInfo: `https://<authentik-host>/application/o/userinfo/`

### 2) Configure redirect URI

Set redirect URI to:

- `http://localhost:3000/api/auth/callback` (local)

If deployed with a different domain, use:

- `https://your-domain/api/auth/callback`

### 3) Set `.env`

Fill these values:

- `AUTH_APP_BASE_URL` (for example `http://localhost:3000`)
- `AUTH_SESSION_SECRET` (long random secret)
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_AUTHORIZATION_URL`
- `OIDC_TOKEN_URL`
- `OIDC_USERINFO_URL`
- optional `OIDC_END_SESSION_URL`

Then restart the app.

## Local Admin Username/Password Login

In addition to SSO, the login page supports local admin credentials from `.env`.

Required variables:

- `LOCAL_AUTH_USERNAME`
- `LOCAL_AUTH_PASSWORD`

Optional:

- `LOCAL_AUTH_DISPLAY_NAME`

The login page shows both options:

- Username/password (local admin)
- Continue with SSO (external OpenID Connect provider)

## Docker Deployment (Web + OSRM)

This repository includes:

- `Dockerfile` for the Next.js web app
- `docker-compose.yml` with:
  - `web` (dashboard)
  - `osrm-init` (extract/partition/customize)
  - `osrm` (routing server)

### 1) Configure environment

```bash
cp .env.example .env
```

Set:

- `DATABASE_URL` (reachable from inside Docker; if DB is on host machine, use `host.docker.internal` instead of `localhost`)
- Auth variables (`AUTH_APP_BASE_URL`, `AUTH_SESSION_SECRET`, and all `OIDC_*` values)
- optional `OSM_PBF_URL` (download source for OSRM data)

### 2) Provide map data

Use either approach:

- put a file at `osrm/data/map.osm.pbf`, or
- set `OSM_PBF_URL` in `.env` and let `osrm-init` download it.

### 3) Start stack

```bash
docker compose up --build
```

Services:

- Web: `http://localhost:3000`
- OSRM: `http://localhost:8549` (internal compose URL used by app is `http://osrm:5000`)

Note: first run can take time while `osrm-init` prepares routing files.

## API Endpoints

- `GET /api/vehicles/current?plate=&activeWithinMinutes=`
- `GET /api/vehicles/:plate/history?from=&to=`
- `GET /api/reports/trips?plate=&from=&to=`
- `GET /api/reports/trips/route?plate=&from=&to=&snap=true|false`
- `GET /api/reports/trips/export.csv?plate=&from=&to=`

Notes:

- `from` and `to` must be ISO datetime.
- max query range is 7 days.

## DB Indexes

Apply recommended indexes:

```bash
psql "$DATABASE_URL" -f db/recommended_indexes.sql
```

## Test

```bash
npm test
```

## Trip Logic Summary

A segment is considered movement when either:

- distance between consecutive points >= `TRIP_MOVE_DISTANCE_M`, or
- `speed_kmh >= TRIP_MOVE_SPEED_KMH`

Trip ends when consecutive stationary duration reaches `TRIP_STOP_MINUTES`.
