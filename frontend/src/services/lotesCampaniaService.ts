import { apiClient } from '@/lib/apiClient';
import { getList } from './_apiHelpers';
import type { LoteCampania } from '@/types/agro';

export interface CrearLoteCampaniaData {
  loteId: string;
  campaniaId: string;
  cultivoId: string;
  superficieSembradaHa: number;
  fechaSiembra?: string;
  rindeEstimadoQqHa?: number;
  precioGranoUsdTn?: number;
}
export interface ActualizarLoteCampaniaData {
  cultivoId?: string;
  superficieSembradaHa?: number;
  fechaSiembra?: string | null;
  rindeEstimadoQqHa?: number | null;
  rindeRealQqHa?: number | null;
  precioGranoUsdTn?: number | null;
  fechaCosecha?: string | null;
}

export const lotesCampaniaService = {
  listar: (params: Record<string, unknown> = {}) => getList<LoteCampania>('/lotes-campania', params),
  obtener: (id: string) => apiClient.get<LoteCampania>(`/lotes-campania/${id}`).then((r) => r.data),
  crear: (data: CrearLoteCampaniaData) =>
    apiClient.post<LoteCampania>('/lotes-campania', data).then((r) => r.data),
  actualizar: (id: string, data: ActualizarLoteCampaniaData) =>
    apiClient.patch<LoteCampania>(`/lotes-campania/${id}`, data).then((r) => r.data),
  eliminar: (id: string) => apiClient.delete(`/lotes-campania/${id}`),
};
