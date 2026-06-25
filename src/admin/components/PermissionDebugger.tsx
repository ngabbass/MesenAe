/**
 * PermissionDebugger - Component untuk debugging permissions
 * Hanya muncul di development mode
 */
import { useState } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PermissionDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const { role, isAdmin, permissions, canView, canEdit } = usePermissions();
  
  // Only show in development or when explicitly enabled
  const isDev = import.meta.env.DEV || localStorage.getItem('debug_permissions') === 'true';
  
  if (!isDev) return null;

  const authData = JSON.parse(localStorage.getItem('admin_auth') || '{}');

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 shadow-lg"
      >
        <Bug className="w-4 h-4" />
        Debug Permissions
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </Button>
      
      <div className={cn(
        "mt-2 bg-background border rounded-lg shadow-xl p-4 overflow-auto max-h-[70vh] transition-all",
        isOpen ? "block" : "hidden"
      )}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Bug className="w-4 h-4" />
          Permission Debugger
        </h3>
        
        <div className="space-y-3 text-xs">
          <div>
            <p className="font-semibold text-primary">Auth Data:</p>
            <div className="bg-muted p-2 rounded mt-1 font-mono text-[10px]">
              <p>Username: {authData.username || '-'}</p>
              <p>Name: {authData.name || '-'}</p>
              <p>Role: <span className="font-bold text-primary">{role}</span></p>
              <p>IsAdmin: {isAdmin ? '✅ Yes' : '❌ No'}</p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-primary">Module Permissions:</p>
            <div className="space-y-1 mt-1">
              {Object.entries(permissions).map(([module, perm]: any) => (
                <div key={module} className="flex items-center justify-between bg-muted p-2 rounded text-[10px]">
                  <span className="font-mono font-semibold">{module}</span>
                  <div className="flex gap-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded font-bold",
                      perm?.view ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                    )}>
                      {perm?.view ? '👁️ View' : '🚫 No View'}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded font-bold",
                      perm?.edit ? "bg-blue-500/20 text-blue-600" : "bg-gray-500/20 text-gray-600"
                    )}>
                      {perm?.edit ? '✏️ Edit' : '🔒 No Edit'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold text-primary">Active Orders Check:</p>
            <div className="bg-muted p-2 rounded mt-1 space-y-1">
              <p>canView('activeOrders'): <span className="font-bold">{canView('activeOrders') ? '✅ TRUE' : '❌ FALSE'}</span></p>
              <p>canEdit('activeOrders'): <span className="font-bold">{canEdit('activeOrders') ? '✅ TRUE' : '❌ FALSE'}</span></p>
              <p>permissions.activeOrders: <code className="text-[9px]">{JSON.stringify(permissions.activeOrders)}</code></p>
            </div>
          </div>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              console.log('=== PERMISSION DEBUG ===');
              console.log('Auth Data:', authData);
              console.log('Role:', role);
              console.log('IsAdmin:', isAdmin);
              console.log('Permissions Object:', permissions);
              console.log('canView(activeOrders):', canView('activeOrders'));
              console.log('canEdit(activeOrders):', canEdit('activeOrders'));
              console.log('=======================');
            }}
            className="w-full text-xs"
          >
            Log to Console
          </Button>
        </div>
      </div>
    </div>
  );
}
