import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TipoUsuario = 'propietario' | 'inversor' | 'acopio' | 'admin';

export interface UsuarioActual {
  id: string;
  email: string;
  nombre: string;
  cuentaId: string;
  tipo: TipoUsuario;
  nombreVisible: string | null;
  walletAddress: string | null;
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
 * Ruta canónica de aterrizaje según el tipo de usuario.
 * Fuente de verdad para el enrutado post-login y para los guards por rol.
 */
export function rutaInicialPorTipo(tipo: TipoUsuario): string {
  switch (tipo) {
    case 'propietario':
      return '/';
    case 'inversor':
      return '/marketplace';
    case 'acopio':
      return '/acopio';
    case 'admin':
      return '/admin';
  }
}
