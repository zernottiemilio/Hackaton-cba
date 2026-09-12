import { apiClient } from '@/lib/apiClient';

export type RolMensaje = 'user' | 'assistant' | 'system';

export interface Mensaje {
  id: string;
  conversacionId: string;
  rol: RolMensaje;
  contenido: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Conversacion {
  id: string;
  cuentaId: string;
  usuarioId: string;
  titulo: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { mensajes: number };
  mensajes?: Mensaje[];
}

export interface EnviarMensajeResponse {
  userMsg: Mensaje;
  assistantMsg: Mensaje;
}

const BASE = '/asistente/conversaciones';

export const asistenteService = {
  listar: () => apiClient.get<Conversacion[]>(BASE).then((r) => r.data),

  obtener: (id: string) =>
    apiClient.get<Conversacion>(`${BASE}/${id}`).then((r) => r.data),

  crear: (titulo?: string) =>
    apiClient.post<Conversacion>(BASE, { titulo }).then((r) => r.data),

  renombrar: (id: string, titulo: string) =>
    apiClient.patch<Conversacion>(`${BASE}/${id}`, { titulo }).then((r) => r.data),

  eliminar: (id: string) => apiClient.delete(`${BASE}/${id}`),

  enviarMensaje: (id: string, contenido: string) =>
    apiClient.post<EnviarMensajeResponse>(`${BASE}/${id}/mensajes`, { contenido }).then((r) => r.data),
};
