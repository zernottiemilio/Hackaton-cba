import { apiClient } from '@/lib/apiClient';
import type { TipoUsuario, UsuarioActual } from '@/stores/authStore';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioActual;
}

export interface RegistroInput {
  tipo: Extract<TipoUsuario, 'propietario' | 'inversor'>;
  email: string;
  password: string;
  nombre: string;
  /** Nombre visible en la plataforma (ficha, marketplace). Opcional. */
  nombreVisible?: string;
  /** Solo requerido para propietarios. Para inversor se defaultea al nombre del usuario. */
  nombreCuenta?: string;
  emailContacto?: string;
  telefono?: string;
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return res.data;
  },

  async registro(input: RegistroInput): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/registro', input);
    return res.data;
  },

  async me(): Promise<UsuarioActual> {
    const res = await apiClient.get<UsuarioActual>('/auth/me');
    return res.data;
  },
};
