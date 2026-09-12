import { apiClient } from '@/lib/apiClient';

export interface CampoResponse {
  id: string;
  nombre: string;
  partido: string | null;
  provincia: string | null;
  superficieTotalHa: number | string | null;
  latitud: number | string | null;
  longitud: number | string | null;
  tenencia: 'propio' | 'arrendado' | 'mixto';
  geometria: GeoJSON.Polygon | null;
  fotos: string[];
  acopioHabitualId: string | null;
  acopioHabitual?: { id: string; razonSocial: string } | null;
  createdAt: string;
  campaniasTokenizadas?: any[];
}

export interface AcopioResponse {
  id: string;
  razonSocial: string;
  cuit: string;
  nivelIntegracion: string;
  plantas: { id: string; nombre: string; localidad: string | null }[];
}

export interface CultivoResponse {
  id: string;
  nombre: string;
}

export interface CrearCampoPayload {
  nombre: string;
  partido: string;
  provincia: string;
  superficieHa: number;
  geometria: GeoJSON.Polygon;
  tenencia?: 'propio' | 'arrendado' | 'mixto';
  acopioHabitualId?: string;
  fotos?: string[];
  latitud?: number;
  longitud?: number;
}

export const camposApi = {
  async listar(): Promise<CampoResponse[]> {
    const { data } = await apiClient.get('/tokenizadas/campos');
    return data;
  },
  async detalle(id: string): Promise<CampoResponse> {
    const { data } = await apiClient.get(`/tokenizadas/campos/${id}`);
    return data;
  },
  async crear(payload: CrearCampoPayload): Promise<CampoResponse> {
    const { data } = await apiClient.post('/tokenizadas/campos', payload);
    return data;
  },
  async actualizar(id: string, payload: Partial<CrearCampoPayload>): Promise<CampoResponse> {
    const { data } = await apiClient.patch(`/tokenizadas/campos/${id}`, payload);
    return data;
  },
  async cultivos(): Promise<CultivoResponse[]> {
    const { data } = await apiClient.get('/tokenizadas/cultivos');
    return data;
  },
  async acopios(): Promise<AcopioResponse[]> {
    const { data } = await apiClient.get('/tokenizadas/acopios');
    return data;
  },
};
