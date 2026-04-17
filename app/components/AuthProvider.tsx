'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'nexdo' | 'radisson' | null;

export type AuthCtx = {
  role: Role;
  isAdmin:       boolean; // full edit + delete + costs + NexDo
  isNexDo:       boolean; // NexDo team — sees NexDo, no costs, stock-adjust only
  isRadisson:    boolean; // Radisson staff — no NexDo, no costs, stock-adjust only
  canSeeCosts:   boolean; // unit cost, order cost, price fields
  canSeeNexDo:   boolean; // NexDo inventory page & nav item
  canEditMeta:   boolean; // name, SKU, PAR, supplier, unit
  canDelete:     boolean; // delete items
  login:  (pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const STORAGE_KEY = 'snapv2-role';
const PUBLIC_PATH = '/login';

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(null);
  const [ready, setReady]    = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Role | null;
    if (saved) setRoleState(saved);
    setReady(true);
  }, []);

  // Guard: redirect to /login if not authenticated
  useEffect(() => {
    if (!ready) return;
    if (!role && pathname !== PUBLIC_PATH) {
      router.replace(PUBLIC_PATH);
    }
  }, [ready, role, pathname, router]);

  const login = useCallback(async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? 'Invalid PIN' };
      const r = data.role as Role;
      localStorage.setItem(STORAGE_KEY, r!);
      setRoleState(r);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRoleState(null);
    router.replace(PUBLIC_PATH);
  }, [router]);

  const ctx: AuthCtx = {
    role,
    isAdmin:     role === 'admin',
    isNexDo:     role === 'nexdo',
    isRadisson:  role === 'radisson',
    canSeeCosts: role === 'admin',
    canSeeNexDo: role === 'admin' || role === 'nexdo',
    canEditMeta: role === 'admin', // Only admin can edit item metadata
    canDelete:   role === 'admin', // Only admin can delete items
    login,
    logout,
  };

  // Don't render protected content until auth is hydrated
  if (!ready) return null;
  if (!role && pathname !== PUBLIC_PATH) return null;

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
