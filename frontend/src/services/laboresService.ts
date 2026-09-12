import { apiClient } from '@/lib/apiClient';
import { getList } from './_apiHelpers';
import type { Ejecutor, FormaPago, Labor, TipoLabor } from '@/types/agro';

export interface CrearLaborData {
  loteCampaniaId: string;
  tipo: TipoLabor;
  fecha: string;
  ejecutor?: Ejecutor;
  costoTotalUsd?: number;
  formaPago?: FormaPago;
  nota?: string;
}
export type ActualizarLaborData = Partial<Omit<CrearLaborData, 'loteCampaniaId'>>;

export const laboresService = {
  listar: (params: Record<string, unknown> = {}) => getList<Labor>('/labores', params),
  obtener: (id: string) => apiClient.get<Labor>(`/labores/${id}`).then((r) => r.data),
  crear: (data: CrearLaborData) => apiClient.post<Labor>('/labores', data).then((r) => r.data),
  actualizar: (id: string, data: ActualizarLaborData) =>
    apiClient.patch<Labor>(`/labores/${id}`, data).then((r) => r.data),
  eliminar: (id: string) => apiClient.delete(`/labores/${id}`),
};
