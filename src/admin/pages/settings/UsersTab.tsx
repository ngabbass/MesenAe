import { useState } from 'react';
import { useDbQuery, dbInsert, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import type { User, StoreSettings } from '@/hooks/db-hooks';
import type { UserPermissions } from '@/hooks/use-permissions';
import { DEFAULT_USER_PERMISSIONS } from '@/hooks/use-permissions';
import { Section, SettingCard, RoleBadge } from '../Settings';
import { Plus, Users, Shield, Edit2, Trash2, UserCog, Key, Eye, EyeOff, BadgeCheck, ChefHat, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { hashPassword } from '@/lib/password';
import { cn } from '@/lib/utils';

export default function UsersTab({ hasEditAccess }: { hasEditAccess: boolean }) {
  const users = useDbQuery<User>('users');
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];
  const isKitchenEnabled = storeSettings?.enableKitchen !== false;

  /* ── Users ── */
  const [userDialog,    setUserDialog]    = useState(false);
  const [userUsername,  setUserUsername]  = useState('');
  const [userName,      setUserName]      = useState('');
  const [userWhatsapp,  setUserWhatsapp]  = useState('');
  const [userPassword,  setUserPassword]  = useState('');
  const [userRole,      setUserRole]      = useState<'admin' | 'user' | 'dapur'>('user');
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(DEFAULT_USER_PERMISSIONS);
  const [userEditId,    setUserEditId]    = useState<number | null>(null);
  const [showPassword,  setShowPassword]  = useState(false);
  const [isSavingUser,  setIsSavingUser]  = useState(false);

  const openUserAdd  = () => { setUserEditId(null); setUserUsername(''); setUserName(''); setUserWhatsapp(''); setUserPassword(''); setUserRole('user'); setUserPermissions(DEFAULT_USER_PERMISSIONS); setShowPassword(false); setUserDialog(true); };
  const openUserEdit = (u: User) => { setUserEditId(u.id!); setUserUsername(u.username); setUserName(u.name ?? ''); setUserWhatsapp(u.whatsapp ?? ''); setUserPassword(''); setUserRole(u.role as 'admin' | 'user' | 'dapur'); setUserPermissions(u.permissions || DEFAULT_USER_PERMISSIONS); setShowPassword(false); setUserDialog(true); };
  
  const saveUser = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengedit pengaturan.');
      return;
    }
    if (!userUsername.trim()) return;
    if (!userEditId && !userPassword) { toast.error('Password wajib diisi untuk pengguna baru'); return; }
    setIsSavingUser(true);
    try {
      let password_hash = '';
      if (userPassword) password_hash = await hashPassword(userPassword);
      if (userEditId) {
        const updates: Record<string, unknown> = { username: userUsername.trim(), role: userRole, name: userName.trim(), whatsapp: userWhatsapp.trim() };
        if (password_hash) updates.password_hash = password_hash;
        if (userRole === 'user') updates.permissions = userPermissions;
        await dbUpdate('users', userEditId, updates);
      } else {
        const newUserData: Record<string, unknown> = { username: userUsername.trim(), password_hash, role: userRole, name: userName.trim(), whatsapp: userWhatsapp.trim(), createdAt: new Date().toISOString() };
        if (userRole === 'user') newUserData.permissions = userPermissions;
        await dbInsert('users', newUserData as User);
      }
      setUserDialog(false); toast.success('Pengguna disimpan');
    } catch (error: any) {
      toast.error('Gagal menyimpan pengguna: ' + (error.message || error));
    } finally { setIsSavingUser(false); }
  };

  const deleteUser = async (id: string | number) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengedit pengaturan.');
      return;
    }
    await dbDelete('users', id);
    toast.success('Pengguna dihapus');
  };

  return (
    <div className="space-y-4">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola data pengguna/staf.</span>
        </div>
      )}
      <div className={cn("space-y-4", !hasEditAccess && "pointer-events-none opacity-75")}>
        <Section
          hideHeader
          title="Manajemen Pengguna"
        >
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-primary/5 border border-primary/15">
            <div className="flex items-center gap-2.5 text-xs text-primary leading-normal min-w-0">
              <Shield className="w-4 h-4 shrink-0 animate-pulse" />
              <span className="truncate sm:whitespace-normal">
                Password dienkripsi kuat menggunakan Bcrypt-TS. Akses dikontrol per peran.
              </span>
            </div>
            {hasEditAccess && (
              <Button size="sm" className="gap-1.5 h-8 text-xs shrink-0 shadow-sm" onClick={openUserAdd}>
                <Plus className="w-3.5 h-3.5" /> Tambah
              </Button>
            )}
          </div>

          {!users?.length ? (
            <SettingCard>
              <div className="flex flex-col items-center py-10 text-center text-muted-foreground gap-2">
                <Users className="w-8 h-8 opacity-25" />
                <p className="text-sm">Belum ada pengguna terdaftar</p>
                {hasEditAccess && (
                <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs h-8" onClick={openUserAdd}>
                  <Plus className="w-3.5 h-3.5" /> Tambah Pengguna Pertama
                </Button>
                )}
              </div>
            </SettingCard>
          ) : (
            <SettingCard>
              {users.filter(u => u.role !== 'dapur' || isKitchenEnabled).map((u, i) => (
                <div
                  key={u.id}
                  className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors', i < users.length - 1 && 'border-b border-border/50')}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0',
                    u.role === 'admin'
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                      : u.role === 'dapur'
                      ? 'bg-gradient-to-br from-rose-400 to-red-500'
                      : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                  )}>
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{u.name || u.username}</span>
                      <RoleBadge role={u.role} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {u.whatsapp ? `WA: ${u.whatsapp}` : (u.role === 'admin' ? 'Akses penuh ke semua fitur' : u.role === 'dapur' ? 'Akses khusus dapur' : 'Hak akses kustom')}
                    </p>
                  </div>
                  {hasEditAccess && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openUserEdit(u)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => deleteUser(u.id!)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  )}
                </div>
              ))}
            </SettingCard>
          )}
        </Section>
      </div>

      {/* ── User Dialog ── */}
      <Dialog open={userDialog} onOpenChange={v => { setUserDialog(v); if (!v) setShowPassword(false); }}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-4 h-4" /> {userEditId ? 'Edit' : 'Tambah'} Pengguna
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Username Login</Label>
              <Input value={userUsername} onChange={e => setUserUsername(e.target.value)} placeholder="contoh: kasir1" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nama Lengkap</Label>
              <Input value={userName} onChange={e => setUserName(e.target.value)} placeholder="contoh: Budi Santoso" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">No WhatsApp</Label>
              <Input 
                value={userWhatsapp} 
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 12) {
                    setUserWhatsapp(val);
                  }
                }} 
                type="tel"
                inputMode="numeric"
                placeholder="085..." 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Password
                {userEditId && <span className="font-normal text-muted-foreground">(kosongkan jika tidak diubah)</span>}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Hak Akses</Label>
              <div className={cn("grid gap-2", isKitchenEnabled ? "grid-cols-3" : "grid-cols-2")}>
                {(['admin', 'user', 'dapur'] as const).filter(role => role !== 'dapur' || isKitchenEnabled).map(role => (
                  <button
                    key={role}
                    onClick={() => setUserRole(role)}
                    className={cn(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      userRole === role
                        ? role === 'admin'
                          ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                          : role === 'user' ? 'border-primary bg-primary/5' : 'border-rose-400 bg-rose-50 dark:bg-rose-900/20'
                        : 'border-border hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {role === 'admin' && <BadgeCheck className={cn('w-4 h-4', userRole === 'admin' ? 'text-amber-600' : 'text-muted-foreground')} />}
                      {role === 'user' && <Shield className={cn('w-4 h-4', userRole === 'user' ? 'text-primary' : 'text-muted-foreground')} />}
                      {role === 'dapur' && <ChefHat className={cn('w-4 h-4', userRole === 'dapur' ? 'text-rose-600' : 'text-muted-foreground')} />}
                      <span className={cn(
                        'text-xs font-semibold',
                        userRole === role
                          ? role === 'admin' ? 'text-amber-700 dark:text-amber-400' : role === 'user' ? 'text-primary' : 'text-rose-700 dark:text-rose-400'
                          : 'text-muted-foreground'
                      )}>
                        {role === 'admin' ? 'Admin' : role === 'user' ? 'Staf' : 'Dapur'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                      {role === 'admin' ? 'Akses penuh' : role === 'user' ? 'Akses kustom' : 'Akses dapur'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {userRole === 'user' && (
              <div className="space-y-3 mt-4 border-t border-border pt-4">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Konfigurasi Akses Modul
                </Label>
                <div className="space-y-2">
                  {(Object.entries({
                    dashboard: 'Dashboard', cashier: 'Kasir', activeOrders: 'Pesanan Aktif',
                    ...(isKitchenEnabled ? { kitchen: 'Dapur' } : {}),
                    history: 'Riwayat Transaksi', products: 'Daftar Produk', categories: 'Kategori', suppliers: 'Supplier',
                    stockIn: 'Stok Masuk', stockOut: 'Stok Keluar', expenses: 'Pengeluaran', customers: 'Data Pelanggan',
                    marketing: 'Promosi & QR Code Meja', tools: 'Utilitas',
                    reports: 'Laporan', settings: 'Pengaturan Sistem'
                  }) as [keyof UserPermissions, string][]).map(([key, label]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border bg-muted/20">
                      <span className="text-xs font-medium">{label}</span>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-[10px] font-medium text-muted-foreground">Lihat</span>
                          <Switch 
                            checked={userPermissions[key]?.view || false}
                            onCheckedChange={(v) => {
                              setUserPermissions(prev => ({
                                ...prev,
                                [key]: { 
                                  view: v, 
                                  edit: v ? (prev[key]?.edit || false) : false 
                                }
                              }));
                            }}
                            className="scale-75 origin-right"
                          />
                        </label>
                        <label className={cn("flex items-center gap-2", !(userPermissions[key]?.view) ? "opacity-50 pointer-events-none" : "cursor-pointer")}>
                          <span className="text-[10px] font-medium text-muted-foreground">Kelola</span>
                          <Switch 
                            checked={userPermissions[key]?.edit || false}
                            onCheckedChange={(v) => {
                              setUserPermissions(prev => ({
                                ...prev,
                                [key]: { 
                                  view: prev[key]?.view || false, 
                                  edit: v 
                                }
                              }));
                            }}
                            className="scale-75 origin-right"
                            disabled={!(userPermissions[key]?.view)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!userEditId && !userPassword && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400">Password wajib diisi untuk pengguna baru.</p>
              </div>
            )}

            <Button className="w-full" onClick={saveUser} disabled={!userUsername.trim() || isSavingUser}>
              {isSavingUser ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : 'Simpan Pengguna'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
