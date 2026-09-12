import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus, Trash2, Loader2, ArrowUp, Sparkles, BarChart3,
  CloudRain, Calculator, Wheat,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { asistenteService, type Conversacion, type Mensaje as MensajeType } from '@/services/asistenteService';
import { extraerMensajeError } from '@/lib/apiClient';
import { Mensaje } from '@/components/asistente/Mensaje';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

const PROMPTS_SUGERIDOS = [
  { icon: Calculator,  texto: '¿Cuál es el margen neto del lote 4?' },
  { icon: CloudRain,   texto: '¿Cuánto llovió en los últimos 30 días?' },
  { icon: Wheat,       texto: '¿Qué cultivo está dando mejor resultado esta campaña?' },
  { icon: BarChart3,   texto: 'Resumime la campaña actual en 3 puntos clave.' },
];

export function AsistentePage() {
  const qc = useQueryClient();
  const [conversacionId, setConversacionId] = useState<string | null>(null);

  const { data: conversaciones } = useQuery({
    queryKey: ['asistente-conversaciones'],
    queryFn: () => asistenteService.listar(),
  });

  const { data: conversacionActiva } = useQuery({
    queryKey: ['asistente-conversacion', conversacionId],
    queryFn: () => asistenteService.obtener(conversacionId!),
    enabled: !!conversacionId,
  });

  const crearConv = useMutation({
    mutationFn: () => asistenteService.crear(),
    onSuccess: (nueva) => {
      qc.invalidateQueries({ queryKey: ['asistente-conversaciones'] });
      setConversacionId(nueva.id);
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  const eliminarConv = useMutation({
    mutationFn: (id: string) => asistenteService.eliminar(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['asistente-conversaciones'] });
      if (id === conversacionId) setConversacionId(null);
      toast.success('Conversación eliminada');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  // Si no hay conversación activa y hay conversaciones, agarrar la primera
  useEffect(() => {
    if (!conversacionId && conversaciones && conversaciones.length > 0) {
      setConversacionId(conversaciones[0].id);
    }
  }, [conversaciones, conversacionId]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
      {/* Sidebar de conversaciones */}
      <aside className="lg:w-72 shrink-0 bg-surface border border-border rounded-2xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <Button
            onClick={() => crearConv.mutate()}
            disabled={crearConv.isPending}
            className="w-full"
          >
            {crearConv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
            Nueva conversación
          </Button>
        </div>

        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversaciones?.length === 0 ? (
            <li className="text-xs text-muted-foreground p-3 text-center">
              Sin conversaciones todavía
            </li>
          ) : (
            conversaciones?.map((c) => (
              <ConversacionItem
                key={c.id}
                conv={c}
                activa={c.id === conversacionId}
                onSelect={() => setConversacionId(c.id)}
                onEliminar={() => {
                  if (confirm('¿Eliminar esta conversación?')) eliminarConv.mutate(c.id);
                }}
              />
            ))
          )}
        </ul>
      </aside>

      {/* Área principal del chat */}
      <main className="flex-1 bg-surface border border-border rounded-2xl flex flex-col overflow-hidden min-h-0">
        {conversacionActiva ? (
          <ChatArea
            mensajes={conversacionActiva.mensajes ?? []}
            conversacionId={conversacionActiva.id}
          />
        ) : (
          <EmptyChatState
            haConversaciones={(conversaciones?.length ?? 0) > 0}
            onCrearNueva={() => crearConv.mutate()}
            creando={crearConv.isPending}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================
// Sidebar item
// ============================================================
function ConversacionItem({
  conv,
  activa,
  onSelect,
  onEliminar,
}: {
  conv: Conversacion;
  activa: boolean;
  onSelect: () => void;
  onEliminar: () => void;
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          'group w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 transition',
          activa
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted text-foreground',
        )}
      >
        <span className="text-sm truncate flex-1 min-w-0">
          {conv.titulo ?? 'Sin título'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEliminar();
          }}
          aria-label="Eliminar"
          className="h-6 w-6 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </button>
    </li>
  );
}

// ============================================================
// Empty state cuando no hay conversación seleccionada
// ============================================================
function EmptyChatState({
  haConversaciones,
  onCrearNueva,
  creando,
}: {
  haConversaciones: boolean;
  onCrearNueva: () => void;
  creando: boolean;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Logo size={36} animated />
        </div>
        <h2 className="text-xl font-bold mt-4 text-foreground">Asistente AgroFácil</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Conectado al estado real de tu cuenta: lotes, campañas, costos, lluvias y clima.
        </p>
        <Button
          onClick={onCrearNueva}
          disabled={creando}
          className="mt-6"
        >
          {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          {haConversaciones ? 'Empezar nueva conversación' : 'Crear primera conversación'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Chat area — mensajes + input
// ============================================================
function ChatArea({ mensajes, conversacionId }: { mensajes: MensajeType[]; conversacionId: string }) {
  const qc = useQueryClient();
  const [borrador, setBorrador] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const enviar = useMutation({
    mutationFn: (contenido: string) => asistenteService.enviarMensaje(conversacionId, contenido),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistente-conversacion', conversacionId] });
      qc.invalidateQueries({ queryKey: ['asistente-conversaciones'] });
      setBorrador('');
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  // Auto-scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, enviar.isPending]);

  const enviarMensaje = () => {
    const texto = borrador.trim();
    if (!texto || enviar.isPending) return;
    enviar.mutate(texto);
  };

  const sinMensajes = mensajes.length === 0;

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-6 min-h-0">
        {sinMensajes ? (
          <PromptsIniciales onElegir={(t) => enviar.mutate(t)} disabled={enviar.isPending} />
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {mensajes.map((m) => (
              <Mensaje key={m.id} mensaje={m} />
            ))}
            <AnimatePresence>
              {enviar.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Logo size={18} />
                  </div>
                  <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:120ms]" />
                    <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:240ms]" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 lg:p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensaje();
              }
            }}
            placeholder="Preguntá algo sobre tu campo, lluvias, márgenes…"
            rows={1}
            className="flex-1 resize-none min-h-[44px] max-h-32 px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface"
            disabled={enviar.isPending}
          />
          <Button
            onClick={enviarMensaje}
            disabled={!borrador.trim() || enviar.isPending}
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Enviar"
          >
            {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          El asistente lee tus datos reales (lotes, costos, lluvias, clima) para responder.
        </p>
      </div>
    </>
  );
}

// ============================================================
// Prompts sugeridos
// ============================================================
function PromptsIniciales({
  onElegir,
  disabled,
}: {
  onElegir: (texto: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col justify-center text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-xl font-bold mt-4 text-foreground">¿En qué te ayudo?</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Probá con una de estas o escribí lo que necesites.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 max-w-2xl mx-auto w-full">
        {PROMPTS_SUGERIDOS.map((p) => (
          <button
            key={p.texto}
            onClick={() => onElegir(p.texto)}
            disabled={disabled}
            className="group text-left rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition p-4 disabled:opacity-50"
          >
            <p.icon className="h-4 w-4 text-primary mb-2" />
            <p className="text-sm text-foreground">{p.texto}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
