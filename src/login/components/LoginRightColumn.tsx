import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, User, Lock, LogIn, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDbQuery } from '@/hooks/db-hooks';

interface LoginRightColumnProps {
  username: string;
  setUsername: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean | ((prev: boolean) => boolean)) => void;
  loading: boolean;
  handleLogin: (e: React.FormEvent) => void;
}

export default function LoginRightColumn({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  loading,
  handleLogin,
}: LoginRightColumnProps) {
  const storeSettingsList = useDbQuery<any>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">
      <div className="w-full max-w-md relative z-10">

        {/* Logo Mobile */}
        <div className="lg:hidden flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 bg-background/50 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10 mb-4 border border-border p-2">
            <img
              src={storeSettings?.logo || "/icon-192.png"}
              alt={storeSettings?.storeName || "MesenAe"}
              className="w-full h-full object-cover drop-shadow-lg rounded-2xl"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const icon = document.createElement('div');
                  icon.className = 'flex items-center justify-center w-full h-full text-foreground font-bold text-2xl';
                  icon.innerHTML = (storeSettings?.storeName || 'MesenAe').charAt(0).toUpperCase();
                  parent.appendChild(icon);
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            {storeSettings?.storeName || 'MesenAe'}
          </h1>
          <p className="text-sm font-medium text-primary mt-1">Management Portal</p>
        </div>

        {/* Kartu Form Login */}
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-[1.5rem] shadow-2xl shadow-primary/5 p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500">
          
          {/* Header Form */}
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Selamat Datang
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              Masukkan akun Anda untuk masuk ke Panel Admin atau Monitor Dapur.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
            
            {/* Username Field */}
            <div className="space-y-2 group">
              <Label htmlFor="username" className="text-sm font-bold text-foreground">
                Username
              </Label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
                  <User className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  disabled={loading}
                  className="h-12 pl-10 pr-4 rounded-lg border-input bg-background/50 focus:bg-background focus:border-primary shadow-sm transition-all text-sm font-medium text-foreground placeholder-muted-foreground disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2 group">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-bold text-foreground">
                  Password
                </Label>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
                  <Lock className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="h-12 pl-10 pr-12 rounded-lg border-input bg-background/50 focus:bg-background focus:border-primary shadow-sm transition-all text-sm font-medium text-foreground placeholder-muted-foreground disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 rounded-lg focus:outline-none"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              id="login-submit"
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className={cn(
                "w-full h-12 rounded-lg text-sm font-bold tracking-wide mt-4 transition-all duration-200 border-none",
                "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30",
                "active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" strokeWidth={2.5} />
                  Masuk ke Sistem
                </span>
              )}
            </Button>
          </form>

        </div>

        {/* Footer Note */}
        <div className="text-center mt-8 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">
            MesenAe Workspace v1.0
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Akses khusus staf dan pengelola restoran terotorisasi.
          </p>
        </div>

      </div>
    </div>
  );
}
