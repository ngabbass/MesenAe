import { useMemo, useSyncExternalStore } from 'react';

export type PermissionAction = 'view' | 'edit';

export interface ModulePermission {
  view: boolean;
  edit: boolean;
}

export interface UserPermissions {
  dashboard: ModulePermission;
  cashier: ModulePermission;
  activeOrders: ModulePermission;
  kitchen: ModulePermission;
  history: ModulePermission;
  products: ModulePermission;
  categories: ModulePermission;
  suppliers: ModulePermission;
  stockIn: ModulePermission;
  stockOut: ModulePermission;
  marketing: ModulePermission;
  tools: ModulePermission;
  reports: ModulePermission;
  settings: ModulePermission;
  expenses: ModulePermission;
  customers: ModulePermission;
}

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  dashboard: { view: true, edit: false },
  cashier: { view: true, edit: true },
  activeOrders: { view: true, edit: true },
  kitchen: { view: false, edit: false },
  history: { view: true, edit: false },
  products: { view: false, edit: false },
  categories: { view: false, edit: false },
  suppliers: { view: false, edit: false },
  stockIn: { view: false, edit: false },
  stockOut: { view: false, edit: false },
  marketing: { view: false, edit: false },
  tools: { view: false, edit: false },
  reports: { view: false, edit: false },
  settings: { view: false, edit: false },
  expenses: { view: false, edit: false },
  customers: { view: false, edit: false },
};

// Custom store for localStorage changes
const createAuthStore = () => {
  let listeners: (() => void)[] = [];
  let lastRaw: string | null = null;
  let lastParsed: any = {};
  
  return {
    subscribe(listener: () => void) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(l => l !== listener);
      };
    },
    getSnapshot() {
      try {
        const stored = localStorage.getItem('admin_auth');
        if (stored === lastRaw) {
          return lastParsed;
        }
        lastRaw = stored;
        lastParsed = stored ? JSON.parse(stored) : {};
        return lastParsed;
      } catch (err) {
        console.warn('Failed to parse admin_auth:', err);
        lastRaw = null;
        lastParsed = {};
        return lastParsed;
      }
    },
    notifyListeners() {
      listeners.forEach(listener => listener());
    }
  };
};

const authStore = createAuthStore();

// Listen to storage events from other tabs/windows
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'admin_auth') {
      authStore.notifyListeners();
    }
  });
}

export function usePermissions() {
  // Use useSyncExternalStore to reactively subscribe to localStorage changes
  const authData = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getSnapshot
  );

  const role = authData.role || 'user';
  const permissions: UserPermissions = authData.permissions || DEFAULT_USER_PERMISSIONS;

  // Admin always has full access
  const isAdmin = role === 'admin';

  const canView = (moduleName: keyof UserPermissions): boolean => {
    if (isAdmin) return true;
    if (role === 'dapur') return moduleName === 'kitchen';
    
    // Ensure permissions object exists and has the module
    if (!permissions || typeof permissions !== 'object') {
      return false;
    }
    
    const modulePerms = permissions[moduleName];
    if (!modulePerms || typeof modulePerms !== 'object') {
      return false;
    }
    
    return modulePerms.view === true;
  };

  const canEdit = (moduleName: keyof UserPermissions): boolean => {
    if (isAdmin) return true;
    if (role === 'dapur') return moduleName === 'kitchen';
    
    // Ensure permissions object exists and has the module
    if (!permissions || typeof permissions !== 'object') {
      return false;
    }
    
    const modulePerms = permissions[moduleName];
    if (!modulePerms || typeof modulePerms !== 'object') {
      return false;
    }
    
    return modulePerms.edit === true;
  };

  return { authData, role, isAdmin, permissions, canView, canEdit };
}

// Helper function to trigger re-render after auth update
export function notifyAuthChange() {
  authStore.notifyListeners();
}
