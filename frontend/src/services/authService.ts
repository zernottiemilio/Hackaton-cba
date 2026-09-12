import { apiClient } from '@/lib/apiClient';
import type { UsuarioActual } from '@/stores/authStore';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioActual;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    return res.data;
  },

  async me(): Promise<UsuarioActual> {
    const res = await apiClient.get<UsuarioActual>('/auth/me');
    return res.data;
  },
};
