import { apiClient } from '@/lib/apiClient';

export type RolMensaje = 'user' | 'assistant' | 'system';

export type AdjuntoMensaje =
  | { tipo: 'image'; url: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; nombre: string }
  | { tipo: 'audio'; url: string; mediaType: string; nombre: string };

export interface Mensaje {
  id: string;
  conversacionId: string;
  rol: RolMensaje;
  contenido: string;
  metadata: (Record<string, unknown> & { adjuntos?: AdjuntoMensaje[] }) | null;
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

  /** Envía texto y opcionalmente imágenes y/o una nota de audio. */
  enviarMensaje: async (
    id: string,
    contenido: string,
    opciones: { imagenes?: File[]; audio?: Blob | null } = {},
  ): Promise<EnviarMensajeResponse> => {
    const { imagenes = [], audio = null } = opciones;
    const form = new FormData();
    form.append('contenido', contenido);
    for (const img of imagenes) form.append('imagenes', img);
    if (audio) {
      // Damos un filename con extensión para que multer respete el filtro.
      const ext =
        audio.type.includes('mp4') ? 'm4a' :
        audio.type.includes('ogg') ? 'ogg' :
        audio.type.includes('wav') ? 'wav' : 'webm';
      form.append('audio', audio, `nota-${Date.now()}.${ext}`);
    }
    const res = await apiClient.post<EnviarMensajeResponse>(
      `${BASE}/${id}/mensajes`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  },
};

/** URL absoluta para mostrar un adjunto subido. */
export function urlAdjuntoAbsoluta(urlRelativa: string): string {
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
  const host = apiBase.replace(/\/api\/v1\/?$/, '');
  return `${host}${urlRelativa}`;
}
