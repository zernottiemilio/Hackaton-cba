import { apiClient } from '@/lib/apiClient';
import { getList } from './_apiHelpers';
import type { Cultivo } from '@/types/agro';

export const cultivosService = {
  listar: (params: Record<string, unknown> = {}) => getList<Cultivo>('/cultivos', params),
  crear: (nombre: string) => apiClient.post<Cultivo>('/cultivos', { nombre }).then((r) => r.data),
  actualizar: (id: string, nombre: string) =>
    apiClient.patch<Cultivo>(`/cultivos/${id}`, { nombre }).then((r) => r.data),
  eliminar: (id: string) => apiClient.delete(`/cultivos/${id}`),
};
