# Railway Deployment Postmortem

**Date:** April 16, 2026  
**Project:** `gallant-stillness` (Railway) · environment `production`  
**Incident:** Multiple deployments failed or deployed with configuration issues  
**Severity:** HIGH (security + reliability)

## Summary

The production Railway deployment (`21` service on `gallant-stillness`) was deployed from a feature branch with critical misconfiguration:
- Wildcard CORS allowed unauthenticated requests from any origin
- No healthcheck, so failed deployments replaced working ones silently
- Demo credentials visible on login page
- No separate worker service (background jobs non-functional)
- Replica limits set to plan max (24 vCPU / 24 GB)
- Custom start command overrode entrypoint logic

**Root cause:** Deploying directly from feature branches (`claude/website-intake-quote-FUeMN`, `fix-*` branches) to production without intermediate staging, gating, or config review.

## What Happened

### Timeline

| Time | Event |
|---|---|
| 10h ago | Deploy `fix-remove-broken-CronJob-and-Controller-from-StrIcalSyncModule` **FAILED** |
| 9h ago | Same commit **REMOVED** |
| ~22 min before audit | Same commit **ACTIVE** and working |

The failure 10 hours ago was likely a transient boot issue (DB migration timeout, Redis connection, etc.) that went undetected because there was no healthcheck configured.

### Configuration Issues Found

1. **No healthcheck path** → Railway marked deployments "Active" the moment the container PID spawned, even if it crashed during boot
2. **Wildcard CORS** → `Access-Control-Allow-Origin: *` allowed any origin to preflight requests
3. **Feature branch deployment** → Production watched `claude/website-intake-quote-FUeMN` instead of `main`
4. **Demo credentials exposed** → `SIGN_IN_PREFILLED` set to `tim@apple.dev`, visible on login page
5. **No worker service** → BullMQ background jobs (emails, calendar sync, workflows) not running
6. **Overprovision** → Replica limits at 24 vCPU / 24 GB (10-20x actual need)
7. **Custom start command** → Overrode Dockerfile CMD/ENTRYPOINT, skipping migration and cron registration logic
8. **Config drift** → Critical settings (healthcheck, restart policy, start command) only in Railway UI, not version controlled

## Fixes Applied

### Code Changes (committed to main)

1. **Expanded `railway.toml`** — moved config into git
   ```toml
   [deploy]
   healthcheckPath = "/healthz"
   healthcheckTimeout = 120
   restartPolicyType = "ON_FAILURE"
   restartPolicyMaxRetries = 10
   ```

2. **Updated CORS in `packages/twenty-server/src/main.ts`**
   ```typescript
   cors: {
     origin: process.env.FRONTEND_URL || 'http://localhost:3001',
     credentials: true,
   }
   ```

3. **Disabled `x-powered-by` header** to reduce fingerprinting

### Manual Changes Required (Railway UI)

**Do these immediately:**

1. Delete `SIGN_IN_PREFILLED` env var (30 sec)
2. Set Healthcheck Path → `/healthz` (30 sec)
3. Drop replica limits to 2 vCPU, 2 GB (1 min)
4. Switch production branch from feature branch → `main` (30 sec)
5. Set `LOG_LEVELS` → `error,warn` (30 sec)

**Architecture changes:**

6. Add second Railway service for worker with start command `yarn workspace twenty-server worker:prod`
7. Create staging environment watching a `develop` branch
8. Enable PR environments for preview URLs on every PR

## Prevention

To prevent this pattern recurring:

- ✅ Switch production to watch `main` (not feature branches)
- ✅ Require healthcheck path (now in `railway.toml`)
- ✅ Enable "Wait for CI" in Railway settings so GitHub Actions gates deployments
- Add staging environment with pre-merge testing
- Document rollback procedure (Railway keeps 30-day history)
- Consider adding `SIGN_IN_PREFILLED_ALLOWED` environment filter to suppress demo UI in production

## Monitoring

After fixes, watch:
- Healthcheck success rate in Railway Metrics
- BullMQ job queue depth (once worker service is added)
- Memory usage (target: steady <1.5 GB; adjust replica limits if needed)
- Error rate in logs during business hours

## Related Issues

- No error logs captured from the 10h-ago failure (would need Railway log export or Sentry integration)
- Rollback capability exists but wasn't documented until now
- CI doesn't gate deployments (GitHub Actions runs but doesn't block merge)

---

**Commit:** `76aa387e` — fix: Railway deployment security & config  
**Branch:** `main`
