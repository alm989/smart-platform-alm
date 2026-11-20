# Phase 0 — Security Lock (2026-11-20)

## Changes
1. **core.js v3.2**
   - Removed on-screen default credentials (`admin/admin` + pin hint)
   - New installs no longer seed LocalStorage with plain `admin/admin` + `1234`
   - `getPublicSession()` returns name/role only (never password/pin)
   - Facilities auto-bootstrap in core is **disabled when `facilities-autoload.js` is present** (prevents double init)
2. **facilities-autoload.js**
   - Stronger single-init guard (`__sfFacilitiesInited` + `__sfAutoloadRunning`)
   - Prefer existing script tag; avoid duplicate network loads
3. **Operational rule**
   - Login source of truth remains **server** (`/api/auth/login`)
   - LocalStorage auth is legacy/offline only and must not display secrets

## Apply on machine
```powershell
cd D:\smart-platform-alm
# pull or copy updated core.js + facilities-autoload.js
cd server
.\COPY-MODULES.bat
# restart server, then in browser:
# sessionStorage.clear(); localStorage.removeItem('smart_users_suite_brain'); location.reload();
```

## Verify
- Login form must NOT show any default user/pass/pin text
- Console: `SuiteFacilities` object once; no double-init warnings
- Header/UI shows display name + role only
