# Maestro Mobile E2E Tests

## Setup

Install Maestro CLI:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Running Tests

First build the app (development build required — Maestro doesn't work with Expo Go):
```bash
cd mobile
npx expo run:android   # or run:ios
```

Then run all flows:
```bash
maestro test .maestro/flows/
```

Run a specific flow:
```bash
maestro test .maestro/flows/login.yaml
```

## Test Accounts

Create a test account in Supabase before running:
- Email: `test@example.com`
- Password: `TestPass123`
- Username: `testuser`

## Flows

| Flow | Description |
|------|-------------|
| `login.yaml` | Sign in, verify home screen |
| `browse-trails.yaml` | List view, map view, search |
| `hike-flow.yaml` | Start → Pause → Resume → End hike |
