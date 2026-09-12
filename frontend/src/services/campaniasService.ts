import { apiClient } from '@/lib/apiClient';
import { getList } from './_apiHelpers';
import type { Campania, TipoCampania } from '@/types/agro';

export interface CrearCampaniaData {
  nombre: string;
  tipo: TipoCampania;
  fechaInicio: string;       // YYYY-MM-DD
  fechaFin?: string;
}
export type ActualizarCampaniaData = Partial<CrearCampaniaData> & { fechaFin?: string | null };

export const campaniasService = {
  listar: (params: Record<string, unknown> = {}) => getList<Campania>('/campanias', params),
  obtener: (id: string) => apiClient.get<Campania>(`/campanias/${id}`).then((r) => r.data),
  crear: (data: CrearCampaniaData) => apiClient.post<Campania>('/campanias', data).then((r) => r.data),
  actualizar: (id: string, data: ActualizarCampaniaData) =>
    apiClient.patch<Campania>(`/campanias/${id}`, data).then((r) => r.data),
  eliminar: (id: string) => apiClient.delete(`/campanias/${id}`),
};
