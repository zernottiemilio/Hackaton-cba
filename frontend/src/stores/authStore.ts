import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Rol único en la plataforma Harvest.fi. `null` = usuario legacy del MVP
 *  que todavía no eligió (mostrarle onboarding o mandarlo al inicio del MVP). */
export type RolPlataforma = 'productor' | 'inversor' | 'acopio' | 'admin_plataforma';
export type RolGlobal = 'superadmin' | 'ingeniero' | 'propietario';
export type RolEnCuenta = 'ingeniero' | 'propietario' | 'operador';

export interface MembresiaResumen {
  cuentaId: string;
  cuentaNombre: string;
  rol: RolEnCuenta;
}

export interface UsuarioActual {
  id: string;
  email: string;
  nombre: string;
  rolGlobal: RolGlobal;
  rolPlataforma: RolPlataforma | null;
  walletAddress: string | null;
  cuentaId: string;
  rolEnCuentaActiva: RolEnCuenta;
  modulosPermitidos: string[];
  membresias: MembresiaResumen[];
  impersonating?: boolean;
  impersonatingCuentaNombre?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioActual | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, usuario: UsuarioActual) => void;
  actualizarUsuario: (patch: Partial<UsuarioActual>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
      setTokens: (access, refresh, usuario) =>
        set({
          accessToken: access,
          refreshToken: refresh,
          usuario,
          isAuthenticated: true,
        }),
      actualizarUsuario: (patch) =>
        set((state) =>
          state.usuario ? { usuario: { ...state.usuario, ...patch } } : state,
        ),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          usuario: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'agrofacil-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        usuario: state.usuario,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

/**
 * Ruta canónica de aterrizaje según el rol Harvest.
 * Si el usuario no eligió rol (legacy MVP), cae al inicio del MVP.
 */
export function rutaInicialPorRol(rolPlataforma: RolPlataforma | null): string {
  switch (rolPlataforma) {
    case 'productor':
      return '/';
    case 'inversor':
      return '/marketplace';
    case 'acopio':
      return '/acopio';
    case 'admin_plataforma':
      return '/admin';
    default:
      return '/';
  }
}
