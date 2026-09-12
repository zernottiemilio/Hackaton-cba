import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { insumosAplicadosService } from '@/services/insumosAplicadosService';
import { EmptyState } from '@/components/ui/EmptyState';
import { EditarInsumoSheet } from '@/components/insumos/EditarInsumoSheet';
import { formatearUsd } from '@/utils/formatters';
import { extraerMensajeError } from '@/lib/apiClient';
import type { InsumoAplicado } from '@/types/agro';

const TIPO_COLOR: Record<string, string> = {
  semilla:      '#A8B948',
  fertilizante: '#0F7702',
  herbicida:    '#F2A03C',
  insecticida:  '#DC2626',
  fungicida:    '#3B82F6',
  otro:         '#64748B',
};

export function InsumosPage() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<InsumoAplicado | null>(null);

  const { data } = useQuery({
    queryKey: ['insumos-aplicados', { limit: 100 }],
    queryFn: () => insumosAplicadosService.listar({ limit: 100 }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => insumosAplicadosService.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insumos-aplicados'] });
      qc.invalidateQueries({ queryKey: ['lote-campania'] });
      qc.invalidateQueries({ queryKey: ['resultado'] });
      toast.success('Insumo eliminado');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Historial completo de aplicaciones</p>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Insumos aplicados</h1>
      </header>

      {!data || data.items.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title="Sin aplicaciones registradas"
          description="Los insumos se cargan desde el detalle del lote en campaña."
        />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence>
            {data.items.map((ins, i) => {
              const color = TIPO_COLOR[ins.tipo] ?? '#047C00';
              return (
                <motion.li
                  key={ins.id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.02 }}
                  className="group rounded-xl bg-surface border border-border px-4 py-3 flex items-center gap-4 hover:border-primary/40 transition"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{ins.producto}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {ins.tipo} · {Number(ins.cantidad).toLocaleString('es-AR')} {ins.unidad}
                      {ins.formaPago ? ` · pago ${ins.formaPago}` : ''}
                    </p>
                  </div>
                  <p className="font-bold text-foreground tabular-nums">{formatearUsd(ins.costoTotalUsd)}</p>
                  <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition">
                    <button
                      onClick={() => setEditando(ins)}
                      className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar "${ins.producto}"?`)) eliminar.mutate(ins.id);
                      }}
                      className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <EditarInsumoSheet
        open={!!editando}
        insumo={editando}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}
