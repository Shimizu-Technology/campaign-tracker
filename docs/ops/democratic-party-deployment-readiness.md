# Democratic Party Deployment Readiness

Last updated: 2026-04-20

## Bottom line

The Democratic Party deployment is **not production-ready** unless it has its **own separate data lane**.

If a separate Democratic Party database has not yet been provisioned, then production readiness has **not** been met.

## Must exist before production sign-off

- [ ] **Separate Neon production database** for Democratic Party data
- [ ] **Documented backup path** for that database
- [ ] **Documented retention window** for backups / restore points
- [ ] **Named restore owner** who can execute recovery without guesswork
- [ ] **Secrets stored in approved secret storage**
- [ ] **Separate production environment variables** for Democratic Party services
- [ ] **Confirmed Render deployment** wired to the Democratic Party database
- [ ] **Confirmed Netlify deployment** wired to the correct Democratic Party environment
- [ ] **Restore drill completed** against the Democratic Party lane
- [ ] **Sign-off on data separation**: no shared production database with Josh & Tina

## Non-negotiable rule

> Democratic Party cannot be called production-ready if it shares the Josh & Tina production database.

Separate frontend or backend deploys are not enough by themselves. The database and backup path must also be separate.

## Current implication

This repo documents Campaign Tracker around the **Josh & Tina** campaign and the **Render + Netlify + Neon** stack, but it does **not** confirm that a separate Democratic Party production database already exists.

Until that is provisioned and tested, Democratic Party should be treated as:
- a future/separate deployment lane requirement
- not yet ready for production data
- blocked on backup and restore ownership

## Approval needed

Leon needs to approve only these items:
- [ ] Democratic Party gets a separate production database
- [ ] Democratic Party gets its own backup / restore path
- [ ] Named owner for restore execution
- [ ] No production launch before restore drill passes
