/**
 * Module-level access policy for Smart Suite JWT RBAC
 *
 * admin / ceo  → ALL modules
 * manager      → finance + ops (no sysadmin)
 * user         → ~15 day-to-day modules
 * guest        → minimal read set
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

/** Day-to-day operator — ~15 tiles on suite launcher */
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
  return list.indexOf(id) >= 0;
}

module.exports = {
  ALL,
  MANAGER_SET,
  USER_SET,
  GUEST_SET,
  modulesForRole,
  canAccessModule
};
