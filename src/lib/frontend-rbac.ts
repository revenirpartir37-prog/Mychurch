import type { UserRole } from './constants'

export type Permission =
  | 'finances:view' | 'finances:create' | 'finances:edit' | 'finances:delete' | 'finances:approve'
  | 'debts:view' | 'debts:create' | 'debts:approve' | 'debts:pay' | 'debts:delete'
  | 'members:view' | 'members:create' | 'members:edit' | 'members:delete' | 'members:export'
  | 'events:view' | 'events:create' | 'events:edit' | 'events:delete'
  | 'attendance:view' | 'attendance:create' | 'attendance:edit' | 'attendance:delete'
  | 'messages:view' | 'messages:send' | 'messages:delete'
  | 'reports:view' | 'reports:export' | 'reports:print'
  | 'archives:view' | 'archives:create' | 'archives:restore' | 'archives:delete' | 'archives:download'
  | 'users:view' | 'users:manage' | 'users:suspend' | 'users:reactivate'

export const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'finances:view', 'finances:create', 'finances:edit', 'finances:delete', 'finances:approve',
    'debts:view', 'debts:create', 'debts:approve', 'debts:pay', 'debts:delete',
    'members:view', 'members:create', 'members:edit', 'members:delete', 'members:export',
    'events:view', 'events:create', 'events:edit', 'events:delete',
    'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete',
    'messages:view', 'messages:send', 'messages:delete',
    'reports:view', 'reports:export', 'reports:print',
    'archives:view', 'archives:create', 'archives:restore', 'archives:delete', 'archives:download',
    'users:view', 'users:manage', 'users:suspend', 'users:reactivate',
  ],
  treasurer: [
    'finances:view', 'finances:create', 'finances:edit', 'finances:approve',
    'debts:view', 'debts:create', 'debts:pay',
    'members:view',
    'events:view',
    'attendance:view',
    'messages:view',
    'reports:view', 'reports:export', 'reports:print',
    'archives:view', 'archives:download',
  ],
  secretary: [
    'finances:view',
    'members:view', 'members:create', 'members:edit', 'members:delete', 'members:export',
    'events:view', 'events:create', 'events:edit', 'events:delete',
    'attendance:view', 'attendance:create', 'attendance:edit',
    'messages:view', 'messages:send',
    'reports:view',
    'archives:view',
  ],
  reader: [
    'members:view',
    'events:view',
    'attendance:view',
    'reports:view',
  ],
}

export function hasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false
  const permissions = DEFAULT_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

export function hasAnyPermission(role: UserRole | null, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

export function canViewFinances(role: UserRole | null): boolean {
  return hasPermission(role, 'finances:view')
}

export function canCreateFinances(role: UserRole | null): boolean {
  return hasPermission(role, 'finances:create')
}

export function canEditFinances(role: UserRole | null): boolean {
  return hasPermission(role, 'finances:edit')
}

export function canDeleteFinances(role: UserRole | null): boolean {
  return hasPermission(role, 'finances:delete')
}

export function canCreateMembers(role: UserRole | null): boolean {
  return hasPermission(role, 'members:create')
}

export function canEditMembers(role: UserRole | null): boolean {
  return hasPermission(role, 'members:edit')
}

export function canDeleteMembers(role: UserRole | null): boolean {
  return hasPermission(role, 'members:delete')
}

export function canCreateEvents(role: UserRole | null): boolean {
  return hasPermission(role, 'events:create')
}

export function canEditEvents(role: UserRole | null): boolean {
  return hasPermission(role, 'events:edit')
}

export function canDeleteEvents(role: UserRole | null): boolean {
  return hasPermission(role, 'events:delete')
}

export function canCreateAttendance(role: UserRole | null): boolean {
  return hasPermission(role, 'attendance:create')
}

export function canEditAttendance(role: UserRole | null): boolean {
  return hasPermission(role, 'attendance:edit')
}

export function canSendMessages(role: UserRole | null): boolean {
  return hasPermission(role, 'messages:send')
}

export function canViewMessages(role: UserRole | null): boolean {
  return hasPermission(role, 'messages:view')
}

export function canCreateDebts(role: UserRole | null): boolean {
  return hasPermission(role, 'debts:create')
}

export function canApproveDebts(role: UserRole | null): boolean {
  return hasPermission(role, 'debts:approve')
}

export function canDeleteDebts(role: UserRole | null): boolean {
  return hasPermission(role, 'debts:delete')
}

export function canViewArchives(role: UserRole | null): boolean {
  return hasPermission(role, 'archives:view')
}

export function canCreateArchives(role: UserRole | null): boolean {
  return hasPermission(role, 'archives:create')
}

export function canManageUsers(role: UserRole | null): boolean {
  return hasPermission(role, 'users:manage')
}
