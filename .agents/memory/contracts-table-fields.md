---
name: contractsTable fields
description: Actual field names on contractsTable — common source of confusion
---

## Rule
`contractsTable` fields: `type`, `status`, `startDate`, `endDate`, `monthlySalary` (NOT `salary`).

There is **no** `trialEndDate` field on the table.

**Why:** Previous code used `contract.salary` in attestation builders and `trialEndDate` in HR alerts — both cause runtime errors.

**How to apply:**
- Attestations: use `contract.monthlySalary`
- Probation/trial period proxy: filter contracts where `startDate` is within last 90 days (no dedicated field exists)
