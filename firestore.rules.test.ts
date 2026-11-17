/**
 * Security Rules Verification Suite (Phase 0: Dirty Dozen)
 * Validates that every adversarial payload violates Firestore rule invariants.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Admin Escalation',
    path: '/admins/attacker_uid_123',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'attacker_uid_123', email: 'attacker@example.com', role: 'admin' }
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    path: '/admins/spoof_uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'spoof_uid', email: 'jwkim9633@gmail.com', role: 'admin' }
  },
  {
    id: 3,
    name: 'Buyback Snooping (Get)',
    path: '/buyback_requests/req_001',
    operation: 'get',
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Buyback Snooping (List)',
    path: '/buyback_requests',
    operation: 'list',
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Buyback Status Forgery',
    path: '/buyback_requests/req_forged',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      cardName: 'Charizard',
      language: '한국어',
      condition: 'PSA 10',
      quantity: 1,
      photoUrls: [],
      status: '거래 완료',
      offerPrice: '9999999'
    }
  },
  {
    id: 6,
    name: 'Buyback Shadow Field',
    path: '/buyback_requests/req_shadow',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      cardName: 'Pikachu',
      language: '일본어',
      condition: 'NM',
      quantity: 1,
      photoUrls: [],
      status: '신규',
      isApprovedByAdmin: true
    }
  },
  {
    id: 7,
    name: 'Buyback Array Bomb (>4 images)',
    path: '/buyback_requests/req_bomb',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      cardName: 'Umbreon',
      language: '일본어',
      condition: 'NM',
      quantity: 1,
      photoUrls: ['1', '2', '3', '4', '5'],
      status: '신규'
    }
  },
  {
    id: 8,
    name: 'Draft Config Leak',
    path: '/site_config/draft',
    operation: 'get',
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Draft/Trashed Product Leak (unfiltered list)',
    path: '/products',
    operation: 'list',
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Unapproved Review Leak',
    path: '/reviews',
    operation: 'list',
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Analytics Tampering / Reading',
    path: '/analytics_events',
    operation: 'list',
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Resource Poisoning / Invalid Document ID',
    path: '/buyback_requests/bad$id!with/slash',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { cardName: 'A'.repeat(50000) }
  }
];
