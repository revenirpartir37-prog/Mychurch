import { db } from './db'

export type Permission =
  | 'finances:view'
  | 'finances:create'
  | 'finances:edit'
  | 'finances:delete'
  | 'finances:approve'
  | 'debts:view'
  | 'debts:create'
  | 'debts:approve'
  | 'debts:pay'
  | 'debts:delete'
  | 'members:view'
  | 'members:create'
  | 'members:edit'
  | 'members:delete'
  | 'members:export'
  | 'events:view'
  | 'events:create'
  | 'events:edit'
  | 'events:delete'
  | 'attendance:view'
  | 'attendance:create'
  | 'attendance:edit'
  | 'attendance:delete'
  | 'messages:view'
  | 'messages:send'
  | 'messages:delete'
  | 'reports:view'
  | 'reports:export'
  | 'reports:print'
  | 'archives:view'
  | 'archives:create'
  | 'archives:restore'
  | 'archives:delete'
  | 'archives:download'
  | 'users:view'
  | 'users:manage'
  | 'users:suspend'
  | 'users:reactivate'

export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
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

export async function getRolePermissions(churchId: string, role: string): Promise<Permission[]> {
  if (role === 'admin') {
    return DEFAULT_PERMISSIONS.admin
  }
  
  const setting = await db.churchSetting.findFirst({
    where: { churchId, key: `rbac:${role}` }
  })
  
  if (setting && setting.value) {
    try {
      return JSON.parse(setting.value) as Permission[]
    } catch {
      // fallback
    }
  }
  
  return DEFAULT_PERMISSIONS[role] || []
}

export async function hasPermission(churchId: string, role: string, permission: Permission): Promise<boolean> {
  const permissions = await getRolePermissions(churchId, role)
  return permissions.includes(permission)
}
