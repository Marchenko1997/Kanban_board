# Run Commands

## Docker (Backend + Built Frontend)

- Default port (8080):
  - `./scripts/start-server.ps1` (Windows PowerShell)
  - `./scripts/start-server.sh` (macOS/Linux)
- Custom host port:
  - PowerShell: `$env:PM_PORT="9000"; ./scripts/start-server.ps1`
  - shell: `PM_PORT=9000 ./scripts/start-server.sh`
- Stop:
  - `./scripts/stop-server.ps1`
  - `./scripts/stop-server.sh`

After start:
- App URL: `http://localhost:8080` (or selected `PM_PORT`)
- API health: `http://localhost:8080/api/health`
- SQLite DB persists on host at `./data/pm.db` (mounted into container).

## Frontend Tests

From `frontend/`:

- Install deps: `npm ci`
- Unit tests: `npm run test:unit`
- E2E tests: `npm run test:e2e`
