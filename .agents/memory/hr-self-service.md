---
name: HR self-service endpoints
description: Complete list of /api/hr/me/* routes for the employee portal (portail employé)
---

All endpoints require auth (Bearer token from localStorage `auth_token`).

- `GET  /api/hr/me/profile` — collaborator profile linked to current userId (404 if not linked)
- `PATCH /api/hr/me/profile` — update phone, address, emergencyContact, avatarUrl only
- `GET  /api/hr/me/payslips` — list of payslips
- `GET  /api/hr/me/payslips/:id/pdf` — PDF download
- `GET  /api/hr/me/contract` — active contract
- `GET  /api/hr/me/leave-requests` — own leave requests
- `POST /api/hr/me/leave-requests` — submit new leave request
- `PATCH /api/hr/me/leave-requests/:id/cancel` — cancel pending request
- `GET  /api/hr/me/leave-balance` — leave balances for current year
- `GET  /api/hr/me/documents` — documents in personal vault
- `GET  /api/hr/me/training` — training records
- `GET  /api/hr/me/evaluations` — evaluation records

**Why:** These are purpose-built self-service routes distinct from the admin `/api/hr/leaves` and `/api/hr/documents` routes. Always prefer `/api/hr/me/*` in the employee portal (`my-space.tsx`) rather than filtering admin endpoints.
