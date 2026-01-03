export type Role = 'admin' | 'gerente' | 'vendedor' | 'servicio';

export interface Permission {
  module: string;
  action: string;
}

const PERMISSIONS: Record<Role, string[]> = {
  admin: ['*'],
  gerente: [
    'leads.view',
    'leads.edit',
    'leads.delete',
    'leads.assign',
    'clients.view',
    'clients.edit',
    'clients.delete',
    'reports.view',
    'inventory.view',
    'inventory.edit',
    'catalog.view',
    'catalog.edit',
    'finance.view',
    'marketing.view',
    'marketing.edit',
    'scheduling.view',
    'pipeline.view'
  ],
  vendedor: [
    'leads.view_assigned',
    'leads.edit_assigned',
    'catalog.view',
    'test_drive.create',
    'finance.view',
    'pipeline.view',
    'clients.view_assigned'
  ],
  servicio: [
    'service.view',
    'service.edit',
    'service_history.view',
    'parts.view',
    'parts.edit',
    'scheduling.view',
    'scheduling.edit',
    'clients.view'
  ]
};

const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ['admin', 'gerente', 'vendedor', 'servicio'],
  leads: ['admin', 'gerente', 'vendedor'],
  pipeline: ['admin', 'gerente', 'vendedor'],
  catalog: ['admin', 'gerente', 'vendedor'],
  finance: ['admin', 'gerente', 'vendedor'],
  scheduling: ['admin', 'gerente', 'servicio'],
  marketing: ['admin', 'gerente'],
  admin: ['admin'],
  users: ['admin']
};

export const hasPermission = (userRole: Role, permission: string): boolean => {
  if (!userRole || !PERMISSIONS[userRole]) return false;

  if (PERMISSIONS[userRole].includes('*')) return true;

  return PERMISSIONS[userRole].includes(permission);
};

export const canAccessModule = (userRole: Role, module: string): boolean => {
  if (!userRole || !MODULE_ACCESS[module]) return false;

  if (userRole === 'admin') return true;

  return MODULE_ACCESS[module].includes(userRole);
};

export const canDeleteLead = (userRole: Role): boolean => {
  return hasPermission(userRole, 'leads.delete');
};

export const canAssignLead = (userRole: Role): boolean => {
  return hasPermission(userRole, 'leads.assign');
};

export const canViewAllLeads = (userRole: Role): boolean => {
  return hasPermission(userRole, 'leads.view') || userRole === 'admin' || userRole === 'gerente';
};

export const canEditCatalog = (userRole: Role): boolean => {
  return hasPermission(userRole, 'catalog.edit') || userRole === 'admin';
};

export const canManageUsers = (userRole: Role): boolean => {
  return userRole === 'admin';
};

export const canDeleteClient = (userRole: Role): boolean => {
  return hasPermission(userRole, 'clients.delete');
};

export const getRoleBadgeColor = (role: Role): string => {
  switch (role) {
    case 'admin':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'gerente':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'vendedor':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'servicio':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export const getRoleDisplayName = (role: Role): string => {
  switch (role) {
    case 'admin':
      return 'Administrador';
    case 'gerente':
      return 'Gerente';
    case 'vendedor':
      return 'Vendedor';
    case 'servicio':
      return 'Servicio Técnico';
    default:
      return role;
  }
};
