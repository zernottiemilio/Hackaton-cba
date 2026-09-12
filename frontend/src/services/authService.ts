import { apiClient } from '@/lib/apiClient';
import type { RolPlataforma, UsuarioActual } from '@/stores/authStore';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioActual;
}

export interface RegistroInput {
  /** Rol Harvest elegido en el registro (productor / inversor). Los demás roles
   *  se crean por seed o desde admin, nunca desde el registro público. */
  rolPlataforma?: Extract<RolPlataforma, 'productor' | 'inversor'>;
  email: string;
  password: string;
  nombre: string;
  /** Solo requerido para productores. Para inversor se defaultea al nombre. */
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
