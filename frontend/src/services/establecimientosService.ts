import { apiClient } from '@/lib/apiClient';
import { getList } from './_apiHelpers';
import type { Establecimiento, Tenencia } from '@/types/agro';

export interface CrearEstablecimientoData {
  nombre: string;
  ubicacion?: string;
  latitud?: number | null;
  longitud?: number | null;
  tenencia?: Tenencia;
  superficieTotalHa?: number;
}
export type ActualizarEstablecimientoData = Partial<CrearEstablecimientoData>;

export const establecimientosService = {
  listar: (params: Record<string, unknown> = {}) => getList<Establecimiento>('/establecimientos', params),
  obtener: (id: string) => apiClient.get<Establecimiento>(`/establecimientos/${id}`).then((r) => r.data),
  crear: (data: CrearEstablecimientoData) =>
    apiClient.post<Establecimiento>('/establecimientos', data).then((r) => r.data),
  actualizar: (id: string, data: ActualizarEstablecimientoData) =>
    apiClient.patch<Establecimiento>(`/establecimientos/${id}`, data).then((r) => r.data),
  eliminar: (id: string) => apiClient.delete(`/establecimientos/${id}`),
};
