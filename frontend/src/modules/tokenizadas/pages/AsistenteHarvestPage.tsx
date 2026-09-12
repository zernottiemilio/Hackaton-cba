import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { asistenteService, type Conversacion, type Mensaje } from '@/services/asistenteService';
import { HarvestLogo } from '../components/brand/HarvestLogo';
import { useAuthStore } from '@/stores/authStore';

/**
 * Asistente Harvest — chat con Claude sobre tokenización, gestión agrícola,
 * clima, precios. Reutiliza el `asistenteService` del MVP (endpoint
 * `/asistente/conversaciones` con `enviarMensaje` multipart).
 *
 * UI Harvest: sidebar dark con lista de conversaciones + panel de chat con
 * burbujas del agente en verde `#2BE06A` y del usuario en gris frío.
 */
export function AsistenteHarvestPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const [conversacionSelId, setConversacionSelId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: conversaciones = [] } = useQuery({
    queryKey: ['asistente', 'conversaciones'],
    queryFn: asistenteService.listar,
  });

  const { data: conversacion } = useQuery({
    queryKey: ['asistente', 'conversacion', conversacionSelId],
    queryFn: () => asistenteService.obtener(conversacionSelId!),
    enabled: !!conversacionSelId,
  });

  useEffect(() => {
    if (conversaciones.length > 0 && !conversacionSelId) {
      setConversacionSelId(conversaciones[0].id);
    }
  }, [conversaciones, conversacionSelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [conversacion?.mensajes?.length]);

  const crearMut = useMutation({
    mutationFn: (titulo?: string) => asistenteService.crear(titulo),
    onSuccess: (nueva) => {
      qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] });
      setConversacionSelId(nueva.id);
    },
  });

  const enviarMut = useMutation({
    mutationFn: async (contenido: string) => {
      if (!conversacionSelId) {
        const nueva = await asistenteService.crear(contenido.slice(0, 40));
        setConversacionSelId(nueva.id);
        return asistenteService.enviarMensaje(nueva.id, contenido);
      }
      return asistenteService.enviarMensaje(conversacionSelId, contenido);
    },
    onSuccess: () => {
      setTexto('');
      qc.invalidateQueries({ queryKey: ['asistente', 'conversacion', conversacionSelId] });
      qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminarMut = useMutation({
    mutationFn: (id: string) => asistenteService.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] });
      setConversacionSelId(null);
    },
  });

  const handleEnviar = () => {
    const trim = texto.trim();
    if (!trim) return;
    enviarMut.mutate(trim);
  };

  return (
    <div className="max-w-7xl mx-auto" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
      <div className="mb-4">
        <div className="hv-label" style={{ fontSize: 10 }}>Agente Harvest</div>
        <h1
          style={{
            color: 'var(--hv-text)',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            marginTop: 6,
          }}
        >
          Preguntale al agente sobre tu campo
        </h1>
      </div>

      <div
        className="grid gap-4 h-full"
        style={{ gridTemplateColumns: '280px 1fr' }}
      >
        {/* Sidebar de conversaciones */}
        <aside
          className="hv-glass"
          style={{
            borderRadius: 16,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflowY: 'auto',
          }}
        >
          <button
            onClick={() => crearMut.mutate(undefined)}
            disabled={crearMut.isPending}
            className="hv-cta"
            style={{
              padding: '10px 14px',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva consulta
          </button>

          {conversaciones.length === 0 ? (
            <div
              style={{
                color: 'var(--hv-text-muted)',
                fontSize: 12,
                padding: 12,
                textAlign: 'center',
              }}
            >
              Sin conversaciones todavía.
            </div>
          ) : (
            conversaciones.map((c) => (
              <ItemConversacion
                key={c.id}
                c={c}
                activo={c.id === conversacionSelId}
                onClick={() => setConversacionSelId(c.id)}
                onEliminar={() => {
                  if (confirm('¿Eliminar esta conversación?')) eliminarMut.mutate(c.id);
                }}
              />
            ))
          )}
        </aside>

        {/* Panel de chat */}
        <section
          className="hv-glass"
          style={{
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            style={{ padding: 24 }}
          >
            {!conversacion || (conversacion.mensajes?.length ?? 0) === 0 ? (
              <EstadoInicial usuarioNombre={usuario?.nombre ?? 'Productor'} />
            ) : (
              <div className="space-y-4">
                {conversacion.mensajes!.map((m) => (
                  <BurbujaMensaje key={m.id} m={m} />
                ))}
                {enviarMut.isPending && <BurbujaEscribiendo />}
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--hv-border-subtle)',
              padding: 16,
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
              }}
            >
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEnviar();
                  }
                }}
                placeholder="Preguntá sobre cotización, tokenización, clima…"
                rows={2}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'var(--hv-bg-input)',
                  border: '1px solid var(--hv-border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'var(--hv-text)',
                  fontFamily: 'var(--hv-font-sans)',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleEnviar}
                disabled={enviarMut.isPending || texto.trim().length === 0}
                className="hv-cta"
                style={{
                  padding: '12px 16px',
                  height: 'fit-content',
                  minWidth: 46,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Enviar (Enter)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 8 }}>
              Enter para enviar · Shift+Enter para línea nueva
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function ItemConversacion({
  c,
  activo,
  onClick,
  onEliminar,
}: {
  c: Conversacion;
  activo: boolean;
  onClick: () => void;
  onEliminar: () => void;
}) {
  const titulo = c.titulo || 'Sin título';
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        background: activo ? 'rgba(43,224,106,0.10)' : 'transparent',
        border: `1px solid ${activo ? 'rgba(43,224,106,0.22)' : 'transparent'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        if (!activo) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
      onMouseLeave={(e) => {
        if (!activo) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: activo ? 'var(--hv-text)' : 'var(--hv-text-2)',
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {titulo}
        </div>
        {c._count && c._count.mensajes > 0 && (
          <div className="hv-label-sm" style={{ fontSize: 9, marginTop: 2 }}>
            {c._count.mensajes} mensaje{c._count.mensajes === 1 ? '' : 's'}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEliminar();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--hv-text-muted)',
          cursor: 'pointer',
          padding: 4,
          borderRadius: 4,
          opacity: 0.5,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.color = 'var(--hv-red-text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.5';
          e.currentTarget.style.color = 'var(--hv-text-muted)';
        }}
        title="Eliminar"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        </svg>
      </button>
    </div>
  );
}

function BurbujaMensaje({ m }: { m: Mensaje }) {
  const esAgente = m.rol === 'assistant';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        justifyContent: esAgente ? 'flex-start' : 'flex-end',
      }}
    >
      {esAgente && (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'rgba(43,224,106,0.12)',
            border: '1px solid rgba(43,224,106,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <HarvestLogo variant="mark" size={22} />
        </div>
      )}
      <div
        style={{
          maxWidth: '70%',
          padding: '10px 14px',
          borderRadius: 14,
          background: esAgente ? 'rgba(43,224,106,0.10)' : 'var(--hv-bg-input)',
          border: `1px solid ${esAgente ? 'rgba(43,224,106,0.22)' : 'var(--hv-border)'}`,
          color: 'var(--hv-text)',
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {m.contenido}
      </div>
    </motion.div>
  );
}

function BurbujaEscribiendo() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'rgba(43,224,106,0.12)',
          border: '1px solid rgba(43,224,106,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HarvestLogo variant="mark" size={22} />
      </div>
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 14,
          background: 'rgba(43,224,106,0.10)',
          border: '1px solid rgba(43,224,106,0.22)',
          display: 'flex',
          gap: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--hv-green)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EstadoInicial({ usuarioNombre }: { usuarioNombre: string }) {
  const sugerencias = [
    '¿Cómo calculo la tasa implícita de mi emisión?',
    '¿Cuándo conviene tokenizar modo porcentual vs fijo?',
    '¿Qué garantías reducen más el descuento?',
    '¿Cómo funciona la liquidación con el acopio?',
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <HarvestLogo variant="mark" size={64} animated />
      <h3
        style={{
          color: 'var(--hv-text)',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          marginTop: 20,
        }}
      >
        Hola {usuarioNombre.split(' ')[0]}
      </h3>
      <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6, maxWidth: 400 }}>
        Soy el agente Harvest. Preguntame sobre precios, tokenización, garantías o
        cualquier duda de tu campo.
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2 max-w-xl w-full">
        {sugerencias.map((s) => (
          <div
            key={s}
            className="hv-mono"
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--hv-border)',
              color: 'var(--hv-text-2)',
              fontSize: 11,
              cursor: 'default',
              textAlign: 'left',
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
