---
name: Workload page - assignee matching fix
description: Why workload uses task-derived assignees instead of collaborators list
---

# Workload matrix uses task-derived assignees, not collaborators

**Rule:** `workload.tsx` builds the assignee list from `tasks[].assigneeId + assigneeName` (unique map), never from `useListCollaborators`.

**Why:** 18 out of 20 collaborators in the seed data have `userId: null`. Tasks are assigned by `userId`, so matching `t.assigneeId === collab.userId` produces zeros for almost everyone. The fix derives assignees directly from tasks — whoever has a task appears in the matrix, with correct load data.

**How to apply:** If a future dev wants to show ALL team members (even those without tasks), they should add collaborators with a `userId` linked to their user account, then switch back to a merge approach. Until then, keep the task-derived approach.
