# Release and Change Management

## 1) Branching and PR Discipline

- Use feature branches for every change.
- Keep PRs scoped (single feature/fix area).
- Include test plan and rollback note in PR body.

## 2) Pre-Release Checklist

- Backend migrations reviewed.
- API contract changes documented in [Backend API](Backend-API).
- Mobile/web compatibility validated.
- User-impacting UX changes documented in user manuals.
- Monitoring alerts adjusted for new flows.

## 3) Documentation Policy

Any functional, API, or workflow change must update:

- [System Architecture](System-Architecture) (if architecture impact)
- [Data Model](Data-Model) (if schema/entity impact)
- [Backend API](Backend-API) (if endpoint/payload impact)
- [Mobile User Manual](Mobile-User-Manual) / [Web User Manual](Web-User-Manual) (if user behavior changes)
- [Role-Based SOPs](Role-Based-SOPs) (if process control changes)

## 4) Versioning

- Tag releases with semantic or date-based convention (team standard).
- Maintain release notes summary:
  - Features
  - Fixes
  - Breaking changes
  - Migration notes

## 5) Rollback Expectations

- Be able to roll back backend and web independently.
- Mobile releases require phased rollout and compatibility checks.
- Keep previous stable configuration references.
