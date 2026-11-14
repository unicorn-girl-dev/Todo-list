# Security Specification & Red Team Audit

## 1. Data Invariants
1. **Strict Ownership**: Every document in `/users/{userId}`, `/modules/{moduleId}`, and `/tasks/{taskId}` belongs to a single verified user (`request.auth.uid`). No cross-user read, list, create, update, or delete is allowed.
2. **Relational Integrity**: A `CourseTask` cannot be created or reassigned to a `moduleId` that does not exist or is not owned by `request.auth.uid` (enforced via `exists()` and `get()`).
3. **Temporal Integrity**: `createdAt` and `updatedAt` must strictly match `request.time`; `createdAt` and `ownerId` are immutable after creation.
4. **Volumetric & Schema Strictness**: Every document requires exact allowed keys (`hasAll` + `hasOnly`), string length bounds matching `firebase-blueprint.json`, integer range bounds, and regex-validated document IDs (`^[a-zA-Z0-9_\-]+$`).
5. **PII Isolation**: `/users/{userId}` forbids `list` queries and restricts `get` strictly to `request.auth.uid == userId`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Identity Spoofing on Module Create**: `{ ownerId: "other-uid", code: "AI-101", ... }` -> Denied (`ownerId != request.auth.uid`).
2. **Shadow Field Injection on Task Create**: `{ ownerId: uid, ..., isAdmin: true }` -> Denied (`hasOnly` rejects unknown key).
3. **Orphaned Task Create**: `{ ownerId: uid, moduleId: "nonexistent-module", ... }` -> Denied (`exists` parent module check fails).
4. **Cross-Owner Module Reference**: `{ ownerId: uid, moduleId: "another-users-module", ... }` -> Denied (`get(module).data.ownerId != request.auth.uid`).
5. **Client-Forged Timestamp**: `{ ..., createdAt: "2020-01-01T00:00:00Z" }` -> Denied (`createdAt != request.time`).
6. **Immutable Owner Mutation on Update**: `{ ownerId: "attacker-uid", updatedAt: serverTimestamp() }` -> Denied (`incoming().ownerId == existing().ownerId` fails).
7. **Immutable CreatedAt Mutation on Update**: `{ createdAt: serverTimestamp(), updatedAt: serverTimestamp() }` -> Denied (`incoming().createdAt == existing().createdAt` fails).
8. **Oversized Notes Resource Poisoning**: `{ ..., notes: "x".repeat(5000) }` -> Denied (`notes.size() <= 2000` fails).
9. **Path ID Poisoning**: Document ID `"bad/id$123"` or 200-char ID -> Denied (`isValidId` regex/length fails).
10. **Invalid Enum Value**: `{ ..., kind: "exam" }` or `{ status: "hacked" }` -> Denied (enum allowlist fails).
11. **Unverified Email Write**: Request with `email_verified: false` -> Denied (`isVerifiedUser()` fails).
12. **Blanket List Scraping**: `getDocs(collection(db, "tasks"))` without `where("ownerId", "==", uid)` -> Denied (`allow list` requires `resource.data.ownerId == request.auth.uid`).
