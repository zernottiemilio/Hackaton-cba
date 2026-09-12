import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { offlineQueue, suscribirseAColaOffline, type QueuedOperation } from '@/lib/offlineQueue';
import { useAuthStore } from '@/stores/authStore';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Hook global que:
 *  - Expone el estado de la cola offline (cantidad de pendientes).
 *  - Detecta cambios de online/offline.
 *  - Drena la cola automáticamente cuando vuelve la conexión.
 *  - Drena al montar (en caso de pendientes de sesiones previas).
 *  - Expone un sincronizarAhora() para acción manual del usuario.
 */
export function useOfflineSync() {
  const qc = useQueryClient();
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendientes, setPendientes] = useState<QueuedOperation[]>(() => offlineQueue.list());
  const [sincronizando, setSincronizando] = useState(false);
  const drainEnCursoRef = useRef(false);

  // --- escuchar cambios en la cola (cross-tab via custom event) ---
  useEffect(() => {
    const unsub = suscribirseAColaOffline(setPendientes);
    return unsub;
  }, []);

  // --- escuchar cambios online/offline ---
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ============================================================
  // DRENAR — envía las operaciones encoladas al server, en orden.
  // ============================================================
  const drenar = useCallback(
    async (silencioso = false): Promise<{ enviadas: number; descartadas: number; quedaron: number }> => {
      if (drainEnCursoRef.current) return { enviadas: 0, descartadas: 0, quedaron: offlineQueue.size() };
      drainEnCursoRef.current = true;
      setSincronizando(true);

      let enviadas = 0;
      let descartadas = 0;

      try {
        const ops = offlineQueue.list();
        const token = useAuthStore.getState().accessToken;

        for (const op of ops) {
          try {
            await axios.request({
              baseURL,
              url: op.url,
              method: op.method,
              data: op.body,
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                // Marca interna para que el interceptor NO vuelva a encolar si falla
                'X-Offline-Drain': '1',
              },
              // skip our interceptor logic by using raw axios (no apiClient)
              timeout: 15000,
            });
            offlineQueue.remove(op.id);
            enviadas += 1;
          } catch (err) {
            const status = axios.isAxiosError(err) ? err.response?.status : undefined;
            // 4xx (excepto 401) → datos inválidos, descartamos para no quedar trabados
            if (status && status >= 400 && status < 500 && status !== 401) {
              offlineQueue.remove(op.id);
              descartadas += 1;
              console.warn(`Op ${op.id} descartada (HTTP ${status}):`, op);
            } else {
              // Network / 5xx / 401 → cortamos para mantener orden, reintentamos después
              offlineQueue.marcarIntento(op.id);
              break;
            }
          }
        }

        const quedaron = offlineQueue.size();

        if (!silencioso) {
          if (enviadas > 0) {
            toast.success(
              `${enviadas} registro${enviadas === 1 ? '' : 's'} sincronizado${enviadas === 1 ? '' : 's'}` +
                (descartadas > 0 ? ` · ${descartadas} con error` : ''),
            );
          } else if (descartadas > 0) {
            toast.error(`${descartadas} registro${descartadas === 1 ? '' : 's'} con error — verificá los datos`);
          } else if (ops.length > 0 && quedaron === ops.length) {
            toast(
              `Señal débil. Tus ${quedaron} registro${quedaron === 1 ? ' está guardado' : 's están guardados'} y se ${quedaron === 1 ? 'sube' : 'suben'} solo${quedaron === 1 ? '' : 's'} cuando vuelva la señal.`,
              { duration: 5000 },
            );
          }
        }

        // Refrescar queries para que la UI muestre los datos del server
        if (enviadas > 0) {
          qc.invalidateQueries();
        }

        return { enviadas, descartadas, quedaron };
      } finally {
        drainEnCursoRef.current = false;
        setSincronizando(false);
      }
    },
    [qc],
  );

  // --- drenar cuando vuelve online ---
  useEffect(() => {
    if (online && offlineQueue.size() > 0) {
      drenar(true).catch(() => undefined);
    }
  }, [online, drenar]);

  // --- drenar al montar (si quedaron operaciones de una sesión anterior) ---
  useEffect(() => {
    if (navigator.onLine && offlineQueue.size() > 0) {
      drenar(true).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- auto-retry periódico silencioso mientras haya pendientes y red ---
  // Reintenta cada 60s. Si el server sigue caído, no muestra error — solo lo vuelve a intentar.
  useEffect(() => {
    if (!online || pendientes.length === 0) return;
    const id = setInterval(() => {
      if (offlineQueue.size() > 0) {
        drenar(true).catch(() => undefined);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [online, pendientes.length, drenar]);

  /** Vacía la cola entera (después de pedir confirmación al usuario). */
  const descartarTodo = useCallback(() => {
    offlineQueue.clear();
    setPendientes([]);
  }, []);

  /** Descarta un op específico por id (sin intentar enviarlo). */
  const descartarUno = useCallback((id: string) => {
    offlineQueue.remove(id);
    setPendientes(offlineQueue.list());
  }, []);

  /** Reintenta un op específico. Devuelve 'ok' | 'error' | 'sin-red'. */
  const reintentarUno = useCallback(async (id: string): Promise<'ok' | 'error' | 'sin-red'> => {
    const op = offlineQueue.list().find((o) => o.id === id);
    if (!op) return 'error';
    if (!navigator.onLine) return 'sin-red';
    const token = useAuthStore.getState().accessToken;
    try {
      await axios.request({
        baseURL,
        url: op.url,
        method: op.method,
        data: op.body,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Offline-Drain': '1',
        },
        timeout: 15000,
      });
      offlineQueue.remove(op.id);
      setPendientes(offlineQueue.list());
      qc.invalidateQueries();
      return 'ok';
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      offlineQueue.marcarIntento(op.id);
      setPendientes(offlineQueue.list());
      if (status && status >= 400 && status < 500 && status !== 401) {
        // 4xx no-recoverable — el server rechazó el dato. Lo dejamos igual para que el usuario decida descartarlo.
        return 'error';
      }
      return 'error';
    }
  }, [qc]);

  return {
    online,
    pendientes,
    cantidadPendientes: pendientes.length,
    sincronizando,
    /** Forzar sincronización manual (botón "Sincronizar ahora"). */
    sincronizarAhora: () => drenar(false),
    /** Vaciar la cola entera (operaciones que no se van a poder enviar). */
    descartarTodo,
    /** Descartar una operación específica por id. */
    descartarUno,
    /** Reintentar el envío de una sola operación. */
    reintentarUno,
  };
}
