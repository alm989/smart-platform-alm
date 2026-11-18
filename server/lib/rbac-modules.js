/**
 * Module-level access policy for Smart Suite JWT RBAC
 * Roles:
 *   admin, ceo  → all modules
 *   manager     → finance + ops core
 *   user        → day-to-day modules (no sysadmin)
 *   guest       → read-only limited set
 */
'use strict';

const ALL = [
  'suite', 'cashbox', 'bank', 'accounting', 'sales', 'warehouse',
  'purchase', 'payroll', 'personnel', 'customers', 'pettycash',
  'secretariat', 'secretary', 'ceo', 'manager', 'contracts',
  'correspondence', 'archive', 'tax', 'budget', 'audit',
  'fixedassets', 'production', 'projects', 'fleet', 'lawyer',
  'assistant', 'chat', 'meeting', 'filehub', 'sysadmin',
  'multicompany', 'pr', 'control-center', 'change-engine'
];

const MANAGER_SET = [
  'suite', 'cashbox', 'bank', 'accounting', 'sales', 'warehouse',
  'purchase', 'payroll', 'personnel', 'customers', 'pettycash',
  'secretariat', 'secretary', 'manager', 'contracts',
  'correspondence', 'archive', 'tax', 'budget', 'audit',
  'fixedassets', 'production', 'projects', 'fleet', 'filehub',
  'meeting', 'chat'
];

const USER_SET = [
  'suite', 'cashbox', 'bank', 'sales', 'warehouse', 'purchase',
  'customers', 'pettycash', 'secretariat', 'secretary',
  'correspondence', 'archive', 'projects', 'meeting', 'chat', 'filehub'
];

const GUEST_SET = [
  'suite', 'sales', 'customers', 'warehouse'
];

function modulesForRole(role) {
  const r = String(role || 'user').toLowerCase();
  if (r === 'admin' || r === 'ceo') return ALL.slice();
  if (r === 'manager') return MANAGER_SET.slice();
  if (r === 'guest') return GUEST_SET.slice();
  return USER_SET.slice();
}

function canAccessModule(role, moduleId) {
  const id = String(moduleId || '').toLowerCase();
  if (!id) return true;
  const list = modulesForRole(role);
  if (list.indexOf('*') >= 0) return true;
  return list.indexOf(id) >= 0;
}

module.exports = {
  ALL,
  modulesForRole,
  canAccessModule
};
