# NOVA Security Specification (Phase 0: Payload-First Security TDD)

## 1. Core Data Invariants
1. **Admin Allowlist Integrity**: Only authenticated users with `email_verified == true` whose UID exists in `/admins/{uid}` (or initial bootstrap `jwkim9633@gmail.com` creating only their own `/admins/{uid}` document) have admin privileges. Email-string-only client checks are never trusted.
2. **Draft & Trash Isolation**: Unauthenticated visitors can NEVER read `site_config/draft`, `visibilityState == 'draft'`, `visibilityState == 'trashed'`, or unapproved reviews (`isApproved == false`).
3. **Buyback PII Isolation**: `buyback_requests` documents contain contact information and private card photos. Public users can ONLY `create` a new request with initial status `'신규'`, empty `adminMemo`, and null/omitted `offerPrice`. Visitors can NEVER `get`, `list`, `update`, or `delete` `buyback_requests`.
4. **Analytics Write-Only Isolation**: Visitors can `create` bounded `analytics_events` documents (`createdAt == request.time`, valid `dateKey`, bounded strings), and can NEVER `read`, `update`, or `delete` them.
5. **Path & Size Guards**: All document IDs match `^[a-zA-Z0-9_-]+$` and `<= 128` chars; every string and list field has strict `.size()` upper bounds.
6. **Temporal Integrity**: `createdAt == request.time` on creation and `updatedAt == request.time` on updates; `createdAt` is immutable after creation.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Admin Escalation**: Non-admin user tries to write `/admins/{theirUid}` with `role: 'admin'`.
2. **Unverified Email Spoof**: User with `email: 'jwkim9633@gmail.com'` and `email_verified: false` tries to write `/admins/{uid}` or read `/buyback_requests`.
3. **Buyback Snooping (Get)**: Unauthenticated visitor or non-admin tries `getDoc('/buyback_requests/req1')`.
4. **Buyback Snooping (List)**: Unauthenticated visitor tries `getDocs('/buyback_requests')`.
5. **Buyback Status Forgery**: Visitor creates `/buyback_requests/req1` with `status: '거래 완료'` or `offerPrice: '9999999'`.
6. **Buyback Shadow Field**: Visitor creates `/buyback_requests/req1` with ghost field `isApprovedByAdmin: true`.
7. **Buyback Array Bomb**: Visitor creates `/buyback_requests/req1` with 10 `photoUrls` (exceeds max 4).
8. **Draft Config Leak**: Visitor tries `getDoc('/site_config/draft')`.
9. **Draft/Trashed Product Leak**: Visitor tries `getDocs('/products')` without `where('visibilityState', '==', 'published')`.
10. **Unapproved Review Leak**: Visitor tries `getDocs('/reviews')` without `where('isApproved', '==', true)`.
11. **Analytics Tampering / Reading**: Visitor tries `getDocs('/analytics_events')` or `updateDoc('/analytics_events/ev1')`.
12. **Resource Poisoning / ID Injection**: Visitor tries to create `/buyback_requests/invalid$id_too_long...` or inject a 50KB `cardName` string.
