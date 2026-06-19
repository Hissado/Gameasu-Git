---
name: Payment / accounting atomicity
description: How customer-payment writes stay consistent with the general ledger; transaction-aware posting pattern.
---

# Payment ↔ ledger atomicity

A customer payment touches three things that must succeed or fail together:
1. insert the `payments` row,
2. increment the invoice `paid_amount` + flip its status,
3. create the double-entry journal posting.

**Rule:** these run inside ONE `db.transaction`. The accounting service exposes a
transaction-aware variant so the caller's `tx` flows all the way down:
`postEntry(opts)` opens its own tx for standalone callers; `postEntryTx(tx, opts)`
runs against a provided handle. `postCustomerPayment(org, id, { tx })` uses
`exec = opts.tx ?? db` for ALL its reads and dispatches to `postEntryTx` when a tx
is given — otherwise the inner posting opens a *separate* transaction/connection
that cannot see the still-uncommitted payment row.

**Why:** before this, the invoice update + payment row were committed before the
posting ran; a posting failure (closed fiscal period, missing journal/account)
left the commercial side saying "paid" with no ledger entry → silent
commercial/ledger divergence.

**How to apply:** any new flow that writes a business row AND posts accounting in
the same request must pass a shared `tx` into the posting helper (add a
`postXxxTx`/`{ tx }` overload rather than calling the self-transacting wrapper
from inside another transaction).

**Known acceptable gap:** `getCurrentFiscalPeriod()` inside `postEntryTx` still
reads via the global `db`. That's fine — it only reads pre-existing fiscal-period
config, never uncommitted payment/invoice data, so it doesn't break rollback.

**TOCTOU guard:** when a pre-transaction validation read (e.g. invoice not
cancelled) is followed by a transactional write, the write itself must re-assert
the condition (`... AND status <> 'cancelled'` + check `.returning()` row count
and throw if zero). The pre-check is only for nice 404/400 messages; the in-tx
guard is the real safety net against a concurrent state change.
