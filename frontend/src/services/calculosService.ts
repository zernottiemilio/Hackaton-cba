import { apiClient } from '@/lib/apiClient';
import type { AgregadoPorCultivo, ResultadoLote, ResumenCampania } from '@/types/agro';

export const calculosService = {
  resultadoLote: (loteCampaniaId: string) =>
    apiClient.get<ResultadoLote>(`/calculos/lotes-campania/${loteCampaniaId}/resultado`).then((r) => r.data),
  porCultivo: (campaniaId: string) =>
    apiClient.get<AgregadoPorCultivo[]>(`/calculos/campanias/${campaniaId}/por-cultivo`).then((r) => r.data),
  resumenCampania: (campaniaId: string) =>
    apiClient.get<ResumenCampania>(`/calculos/campanias/${campaniaId}/resumen`).then((r) => r.data),
};
