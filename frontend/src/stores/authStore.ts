import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RolGlobal = 'superadmin' | 'ingeniero' | 'propietario';
export type RolEnCuenta = 'ingeniero' | 'propietario' | 'operador';
export type RolPlataforma = 'productor' | 'inversor' | 'acopio' | 'admin_plataforma';

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
  /** Rol único del usuario en Harvest.fi. Decide qué shell/rutas ve al hacer
   *  login. Null para usuarios legacy del MVP sin haber elegido rol Harvest. */
  rolPlataforma: RolPlataforma | null;
  /** Wallet Solana asociada al usuario (mock por ahora). */
  walletAddress: string | null;
  cuentaId: string;
  rolEnCuentaActiva: RolEnCuenta;
  /** Módulos explícitos. Vacío = usa los defaults del rol. */
  modulosPermitidos: string[];
  membresias: MembresiaResumen[];
  impersonating?: boolean;
  impersonatingCuentaNombre?: string;
}

/// Tokens del superadmin previos a impersonar. Sirven para volver a su sesión real
/// con un solo click ("Salir del modo cuenta") sin pedirle la password.
export interface SesionPrevia {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioActual;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioActual | null;
  isAuthenticated: boolean;
  /** Sesión original del superadmin antes de impersonar. Si no es null, está en modo impersonación. */
  sesionPrevia: SesionPrevia | null;
  setTokens: (access: string, refresh: string, usuario: UsuarioActual) => void;
  iniciarImpersonacion: (access: string, refresh: string, usuario: UsuarioActual) => void;
  finalizarImpersonacion: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
      sesionPrevia: null,
      setTokens: (access, refresh, usuario) =>
        set({
          accessToken: access,
          refreshToken: refresh,
          usuario,
          isAuthenticated: true,
        }),
      iniciarImpersonacion: (access, refresh, usuario) => {
        const { accessToken, refreshToken, usuario: actual, sesionPrevia } = get();
        // Si ya estábamos impersonando, no machaquemos la sesión original.
        const previa: SesionPrevia | null = sesionPrevia
          ? sesionPrevia
          : accessToken && refreshToken && actual
          ? { accessToken, refreshToken, usuario: actual }
          : null;
        set({
          accessToken: access,
          refreshToken: refresh,
          usuario,
          isAuthenticated: true,
          sesionPrevia: previa,
        });
      },
      finalizarImpersonacion: () => {
        const previa = get().sesionPrevia;
        if (!previa) return;
        set({
          accessToken: previa.accessToken,
          refreshToken: previa.refreshToken,
          usuario: previa.usuario,
          isAuthenticated: true,
          sesionPrevia: null,
        });
      },
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          usuario: null,
          isAuthenticated: false,
          sesionPrevia: null,
        }),
    }),
    {
      name: 'agrofacil-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        usuario: state.usuario,
        isAuthenticated: state.isAuthenticated,
        sesionPrevia: state.sesionPrevia,
      }),
    },
  ),
);
