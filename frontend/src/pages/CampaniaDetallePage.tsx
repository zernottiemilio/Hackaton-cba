import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Plus, Trash2, Loader2, Sprout, Snowflake, Sun, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { campaniasService } from '@/services/campaniasService';
import { lotesService } from '@/services/lotesService';
import { cultivosService } from '@/services/cultivosService';
import { lotesCampaniaService } from '@/services/lotesCampaniaService';
import { extraerMensajeError } from '@/lib/apiClient';
import { formatearFecha, formatearHa, formatearQqHa, formatearUsd } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const schema = z.object({
  loteId: z.string().uuid('Elegí un lote'),
  cultivoId: z.string().uuid('Elegí un cultivo'),
  superficieSembradaHa: z.coerce.number().positive(),
  fechaSiembra: z.string().optional().or(z.literal('')),
  rindeEstimadoQqHa: z.coerce.number().nonnegative().optional(),
  precioGranoUsdTn: z.coerce.number().positive().optional(),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const colorCultivo = (nombre: string) => {
  const map: Record<string, string> = {
    soja: '#A8B948', trigo: '#E8B53D', maíz: '#F2A03C',
    maiz: '#F2A03C', girasol: '#F4D03F', sorgo: '#B8482A',
  };
  return map[nombre.toLowerCase()] ?? '#047C00';
};

export function CampaniaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: campania } = useQuery({
    queryKey: ['campania', id],
    queryFn: () => campaniasService.obtener(id!),
    enabled: !!id,
  });

  const { data: lcList } = useQuery({
    queryKey: ['lotes-campania', { campaniaId: id }],
    queryFn: () => lotesCampaniaService.listar({ campaniaId: id, limit: 100 }),
    enabled: !!id,
  });

  const eliminar = useMutation({
    mutationFn: (lcId: string) => lotesCampaniaService.eliminar(lcId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes-campania', { campaniaId: id }] });
      qc.invalidateQueries({ queryKey: ['campania', id] });
      toast.success('Lote desasignado de la campaña');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  if (!campania) {
    return <div className="h-64 shimmer rounded-xl" />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/campanias" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Campañas
      </Link>

      <header className="rounded-2xl bg-surface border border-border p-4 sm:p-6 flex items-start sm:items-center gap-3 sm:gap-4 relative overflow-hidden">
        <div className={cn(
          'h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center shrink-0',
          campania.tipo === 'fina' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning',
        )}>
          {campania.tipo === 'fina' ? <Snowflake className="h-6 w-6 sm:h-7 sm:w-7" /> : <Sun className="h-6 w-6 sm:h-7 sm:w-7" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[11px] uppercase tracking-widest font-semibold',
            campania.tipo === 'fina' ? 'text-info' : 'text-warning',
          )}>
            Campaña {campania.tipo}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{campania.nombre}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {formatearFecha(campania.fechaInicio)}
            {campania.fechaFin ? ` → ${formatearFecha(campania.fechaFin)}` : ' · sin fecha de cierre'}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Asignar lote</span>
        </Button>
      </header>

      {!lcList || lcList.items.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Esta campaña no tiene lotes asignados"
          description="Cada lote se asigna con un cultivo, superficie sembrada y rinde estimado. Después podés cargar labores e insumos."
          action={{ label: 'Asignar primer lote', onClick: () => setCreating(true) }}
        />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {lcList.items.map((lc, i) => {
              const color = colorCultivo(lc.cultivo?.nombre ?? '');
              return (
                <motion.li
                  key={lc.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.03 }}
                  className="group relative rounded-2xl bg-surface border border-border hover:border-primary/40 hover:shadow-lift transition overflow-hidden"
                >
                  {/* Stripe del cultivo */}
                  <div className="h-1.5" style={{ background: color }} />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {lc.lote?.establecimiento?.nombre ?? '—'}
                        </p>
                        <h3 className="font-bold text-foreground truncate text-lg">
                          {lc.lote?.nombre ?? 'Lote'}
                        </h3>
                        <span
                          className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `${color}22`, color }}
                        >
                          {lc.cultivo?.nombre}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('¿Quitar este lote de la campaña?')) eliminar.mutate(lc.id);
                        }}
                        className="h-8 w-8 lg:opacity-0 lg:group-hover:opacity-100 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition"
                        aria-label="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 mt-4">
                      <Metric label="Superficie" value={formatearHa(lc.superficieSembradaHa)} />
                      <Metric
                        label="Rinde estimado"
                        value={lc.rindeEstimadoQqHa ? formatearQqHa(lc.rindeEstimadoQqHa) : '—'}
                      />
                      <Metric
                        label="Precio"
                        value={lc.precioGranoUsdTn ? `${formatearUsd(lc.precioGranoUsdTn)}/tn` : '—'}
                      />
                      <Metric
                        label="Siembra"
                        value={lc.fechaSiembra ? formatearFecha(lc.fechaSiembra) : '—'}
                      />
                    </dl>

                    <Link
                      to={`/lotes-campania/${lc.id}`}
                      className="mt-4 flex items-center justify-between text-sm text-primary font-medium hover:underline"
                    >
                      Ver resultado y cargar
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <AsignarLoteSheet
        open={creating}
        campaniaId={id!}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function AsignarLoteSheet({
  open,
  campaniaId,
  onClose,
}: {
  open: boolean;
  campaniaId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: lotes } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => lotesService.listar({ limit: 100 }),
  });
  const { data: cultivos } = useQuery({
    queryKey: ['cultivos'],
    queryFn: () => cultivosService.listar({ limit: 100 }),
  });
  const { data: yaAsignados } = useQuery({
    queryKey: ['lotes-campania', { campaniaId }],
    queryFn: () => lotesCampaniaService.listar({ campaniaId, limit: 100 }),
    enabled: open,
  });

  const lotesDisponibles = (lotes?.items ?? []).filter(
    (l) => !yaAsignados?.items.some((lc) => lc.loteId === l.id),
  );

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      loteId: '',
      cultivoId: '',
      superficieSembradaHa: 0,
      fechaSiembra: '',
      rindeEstimadoQqHa: undefined,
      precioGranoUsdTn: undefined,
    },
  });

  const cultivoId = watch('cultivoId');
  const loteId = watch('loteId');
  const loteSeleccionado = lotes?.items.find((l) => l.id === loteId);

  // Autocompletar superficie con la del lote
  const autocompletarSuperficie = (id: string) => {
    const l = lotes?.items.find((x) => x.id === id);
    if (l) setValue('superficieSembradaHa', Number(l.superficieHa));
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        loteId: data.loteId,
        cultivoId: data.cultivoId,
        campaniaId,
        superficieSembradaHa: data.superficieSembradaHa,
        ...(data.fechaSiembra ? { fechaSiembra: data.fechaSiembra } : {}),
        ...(data.rindeEstimadoQqHa ? { rindeEstimadoQqHa: data.rindeEstimadoQqHa } : {}),
        ...(data.precioGranoUsdTn ? { precioGranoUsdTn: data.precioGranoUsdTn } : {}),
      };
      return lotesCampaniaService.crear(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes-campania'] });
      qc.invalidateQueries({ queryKey: ['campania', campaniaId] });
      toast.success('Lote asignado');
      reset();
      onClose();
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Asignar lote a la campaña"
      description="Definí cultivo, superficie sembrada y rinde estimado."
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {/* Selector de lote */}
        <div className="space-y-2">
          <Label>Lote</Label>
          {lotesDisponibles.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
              No hay lotes disponibles para asignar. Creá uno desde el menú "Lotes".
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto pr-1">
              {lotesDisponibles.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setValue('loteId', l.id, { shouldValidate: true });
                    autocompletarSuperficie(l.id);
                  }}
                  className={cn(
                    'text-left px-3 py-2 rounded-lg border flex items-center justify-between transition',
                    loteId === l.id
                      ? 'border-primary bg-primary/8'
                      : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  <span>
                    <span className="font-medium text-foreground">{l.nombre}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {l.establecimiento?.nombre} · {formatearHa(l.superficieHa)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {errors.loteId && <p className="text-xs text-destructive">{errors.loteId.message}</p>}
        </div>

        {/* Cultivo — chips de colores */}
        <div className="space-y-2">
          <Label>Cultivo</Label>
          <div className="flex flex-wrap gap-2">
            {cultivos?.items.map((c) => {
              const color = colorCultivo(c.nombre);
              const active = cultivoId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setValue('cultivoId', c.id, { shouldValidate: true })}
                  className={cn(
                    'h-9 px-3 rounded-full text-sm font-medium capitalize transition border',
                    active ? 'text-white' : 'text-foreground bg-surface hover:opacity-90',
                  )}
                  style={
                    active
                      ? { background: color, borderColor: color }
                      : { borderColor: `${color}55`, color }
                  }
                >
                  {c.nombre}
                </button>
              );
            })}
          </div>
          {errors.cultivoId && <p className="text-xs text-destructive">{errors.cultivoId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="sup">Superficie (ha) *</Label>
            <Input id="sup" type="number" step="0.01" min="0"
              {...register('superficieSembradaHa', { setValueAs: (v) => (v === '' ? 0 : Number(v)) })} />
            {loteSeleccionado && (
              <p className="text-[11px] text-muted-foreground">
                Lote: {formatearHa(loteSeleccionado.superficieHa)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fs">Siembra</Label>
            <Input id="fs" type="date" {...register('fechaSiembra')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="r">Rinde estimado (qq/ha)</Label>
            <Input id="r" type="number" step="0.1" min="0" placeholder="Ej: 38"
              {...register('rindeEstimadoQqHa', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Precio (USD/tn)</Label>
            <Input id="p" type="number" step="0.01" min="0" placeholder="Ej: 320"
              {...register('precioGranoUsdTn', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Asignar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
