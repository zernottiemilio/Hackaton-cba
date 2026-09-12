import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Sprout, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { lotesService } from '@/services/lotesService';
import { establecimientosService } from '@/services/establecimientosService';
import { extraerMensajeError } from '@/lib/apiClient';
import { formatearHa, formatearUsd } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { Lote, Tenencia, UnidadArrendamiento } from '@/types/agro';

const schema = z
  .object({
    establecimientoId: z.string().uuid('Elegí un establecimiento'),
    nombre: z.string().min(1, 'Requerido'),
    superficieHa: z.coerce.number().positive('Debe ser > 0'),
    tenencia: z.enum(['propio', 'arrendado', 'mixto']),
    arrendamientoValor: z.coerce.number().nonnegative().optional(),
    arrendamientoUnidad: z.enum(['qq_ha', 'usd_ha', 'pct_produccion']).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.tenencia === 'arrendado') {
      if (!d.arrendamientoValor)
        ctx.addIssue({ code: 'custom', message: 'Requerido', path: ['arrendamientoValor'] });
      if (!d.arrendamientoUnidad)
        ctx.addIssue({ code: 'custom', message: 'Requerido', path: ['arrendamientoUnidad'] });
    }
  });
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const UNIDADES: { value: UnidadArrendamiento; label: string; help: string }[] = [
  { value: 'qq_ha',         label: 'qq/ha',  help: 'Quintales por hectárea' },
  { value: 'usd_ha',        label: 'USD/ha', help: 'Dólares por hectárea' },
  { value: 'pct_produccion', label: '%',     help: '% de la producción' },
];

export function LotesPage() {
  const [estabFiltro, setEstabFiltro] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Lote | null>(null);
  const qc = useQueryClient();

  const { data: establecimientos } = useQuery({
    queryKey: ['establecimientos'],
    queryFn: () => establecimientosService.listar({ limit: 100 }),
  });

  const { data: lotes, isLoading } = useQuery({
    queryKey: ['lotes', { establecimientoId: estabFiltro || undefined }],
    queryFn: () => lotesService.listar({ limit: 100, establecimientoId: estabFiltro || undefined }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => lotesService.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes'] });
      toast.success('Lote eliminado');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: false });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => { emblaApi.off('select', onSelect); emblaApi.off('reInit', onSelect); };
  }, [emblaApi]);

  const totalSuperficie = useMemo(
    () => lotes?.items.reduce((s, l) => s + Number(l.superficieHa), 0) ?? 0,
    [lotes],
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            {lotes ? `${lotes.total} lote${lotes.total === 1 ? '' : 's'} · ${formatearHa(totalSuperficie)} de superficie` : '—'}
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Tus lotes</h1>
        </div>
        <div className="flex gap-2 items-center">
          {establecimientos && establecimientos.items.length > 0 && (
            <select
              value={estabFiltro}
              onChange={(e) => setEstabFiltro(e.target.value)}
              className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
            >
              <option value="">Todos los campos</option>
              {establecimientos.items.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          )}
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nuevo lote
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-72 h-56 rounded-2xl bg-surface border border-border shimmer shrink-0" />
          ))}
        </div>
      ) : !lotes || lotes.items.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Sin lotes aún"
          description="Creá tu primer lote dentro de un establecimiento. Después le asignás cultivos por campaña."
          action={
            establecimientos && establecimientos.items.length > 0
              ? { label: 'Crear primer lote', onClick: () => setCreating(true) }
              : undefined
          }
        />
      ) : (
        <>
          <div className="embla relative" ref={emblaRef}>
            <div className="embla__container gap-4 py-1">
              <AnimatePresence>
                {lotes.items.map((lote, i) => (
                  <motion.div
                    key={lote.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.025 }}
                    className="embla__slide w-[290px] sm:w-[320px]"
                  >
                    <LoteCard
                      lote={lote}
                      onEdit={() => setEditing(lote)}
                      onDelete={() => {
                        if (confirm(`¿Eliminar "${lote.nombre}"?`)) eliminar.mutate(lote.id);
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="absolute -top-12 right-0 flex gap-1">
              <NavButton onClick={() => emblaApi?.scrollPrev()} disabled={!canPrev}>
                <ChevronLeft className="h-4 w-4" />
              </NavButton>
              <NavButton onClick={() => emblaApi?.scrollNext()} disabled={!canNext}>
                <ChevronRight className="h-4 w-4" />
              </NavButton>
            </div>
          </div>
        </>
      )}

      <LoteSheet
        open={creating || !!editing}
        editing={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function NavButton({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 w-8 rounded-md border border-border bg-surface inline-flex items-center justify-center transition',
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:border-primary/40 hover:text-primary',
      )}
    >
      {children}
    </button>
  );
}

function LoteCard({
  lote,
  onEdit,
  onDelete,
}: {
  lote: Lote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const arrendado = lote.tenencia === 'arrendado';
  return (
    <article className="group h-full rounded-2xl bg-surface border border-border p-5 hover:border-primary/40 hover:shadow-lift transition flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {lote.establecimiento?.nombre ?? '—'}
          </p>
          <h3 className="font-bold text-foreground truncate text-lg">{lote.nombre}</h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={onEdit} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Editar">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center justify-center" aria-label="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hero — superficie */}
      <div className="mt-4">
        <p className="display-number text-4xl text-foreground leading-none">
          {Number(lote.superficieHa).toLocaleString('es-AR', { maximumFractionDigits: 1 })}
          <span className="text-base text-muted-foreground font-semibold ml-1">ha</span>
        </p>
      </div>

      {/* Tenencia + arrendamiento */}
      <div className="mt-auto pt-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-xs px-2.5 py-1 rounded-full font-medium',
            lote.tenencia === 'propio' && 'bg-primary/10 text-primary',
            lote.tenencia === 'arrendado' && 'bg-warning/10 text-warning',
            lote.tenencia === 'mixto' && 'bg-info/10 text-info',
            !lote.tenencia && 'bg-muted text-muted-foreground',
          )}>
            {lote.tenencia ?? 'Sin definir'}
          </span>
        </div>
        {arrendado && lote.arrendamientoValor && (
          <div className="rounded-lg bg-warning/5 border border-warning/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-warning font-semibold">Alquiler</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {Number(lote.arrendamientoValor).toLocaleString('es-AR')}{' '}
              <span className="text-xs font-medium text-muted-foreground">
                {labelUnidad(lote.arrendamientoUnidad)}
              </span>
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function labelUnidad(u: UnidadArrendamiento | null) {
  if (u === 'qq_ha') return 'qq/ha';
  if (u === 'usd_ha') return 'USD/ha';
  if (u === 'pct_produccion') return '% producción';
  return '';
}

function LoteSheet({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Lote | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: establecimientos } = useQuery({
    queryKey: ['establecimientos'],
    queryFn: () => establecimientosService.listar({ limit: 100 }),
  });
  const isEdit = !!editing;

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    values: editing
      ? {
          establecimientoId: editing.establecimientoId,
          nombre: editing.nombre,
          superficieHa: Number(editing.superficieHa),
          tenencia: (editing.tenencia ?? 'propio') as Tenencia,
          arrendamientoValor: editing.arrendamientoValor ? Number(editing.arrendamientoValor) : undefined,
          arrendamientoUnidad: (editing.arrendamientoUnidad ?? undefined) as UnidadArrendamiento | undefined,
        }
      : {
          establecimientoId: '',
          nombre: '',
          superficieHa: 0,
          tenencia: 'propio',
          arrendamientoValor: undefined,
          arrendamientoUnidad: undefined,
        },
  });
  const tenencia = watch('tenencia');
  const unidadArr = watch('arrendamientoUnidad');
  const supObservada = Number(watch('superficieHa') ?? 0) || 0;

  const mutation = useMutation({
    mutationFn: (data: FormData) => isEdit ? lotesService.actualizar(editing!.id, data) : lotesService.crear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes'] });
      toast.success(isEdit ? 'Lote actualizado' : 'Lote creado');
      reset();
      onClose();
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? 'Editar lote' : 'Nuevo lote'}
      description={isEdit ? undefined : 'Cargá el lote dentro de uno de tus campos.'}
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="estab">Establecimiento *</Label>
            <select
              id="estab"
              {...register('establecimientoId')}
              className="w-full h-10 px-3 rounded-md border border-input bg-surface text-sm"
            >
              <option value="">— Elegir campo —</option>
              {establecimientos?.items.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
            {errors.establecimientoId && <p className="text-xs text-destructive">{errors.establecimientoId.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" placeholder="Ej: Lote 4" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup">Superficie (ha) *</Label>
            <Input id="sup" type="number" step="0.01" min="0" placeholder="80"
              {...register('superficieHa', { setValueAs: (v) => (v === '' ? 0 : Number(v)) })} />
            {errors.superficieHa && <p className="text-xs text-destructive">{errors.superficieHa.message}</p>}
          </div>
        </div>

        {/* Preview animado de superficie */}
        {supObservada > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg bg-primary/8 border border-primary/20 p-3 flex items-center gap-3"
          >
            <Sprout className="h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{formatearHa(supObservada)}</span>{' '}
              <span className="text-muted-foreground">de superficie sembrable</span>
            </p>
          </motion.div>
        )}

        <div className="space-y-2">
          <Label>Tenencia</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['propio', 'arrendado', 'mixto'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('tenencia', t, { shouldValidate: true })}
                className={cn(
                  'h-11 rounded-lg border text-sm font-medium capitalize transition',
                  tenencia === t
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border bg-surface hover:border-primary/40',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tenencia === 'arrendado' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-warning/5 border border-warning/20 p-4 space-y-3"
          >
            <p className="text-[11px] uppercase tracking-wider font-semibold text-warning">
              Datos del arrendamiento
            </p>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="arrVal">Valor</Label>
                <Input id="arrVal" type="number" step="0.01" min="0"
                  {...register('arrendamientoValor', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
                {errors.arrendamientoValor && <p className="text-xs text-destructive">{errors.arrendamientoValor.message}</p>}
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>Unidad</Label>
                <div className="grid grid-cols-3 gap-1">
                  {UNIDADES.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setValue('arrendamientoUnidad', u.value, { shouldValidate: true })}
                      className={cn(
                        'h-10 rounded-md border text-xs font-medium transition',
                        unidadArr === u.value
                          ? 'border-warning bg-warning/10 text-warning'
                          : 'border-border bg-surface hover:border-warning/40',
                      )}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
                {errors.arrendamientoUnidad && <p className="text-xs text-destructive">{errors.arrendamientoUnidad.message}</p>}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {unidadArr === 'qq_ha' && 'Costo en quintales por hectárea — se valoriza al precio del grano del lote.'}
              {unidadArr === 'usd_ha' && 'Costo fijo en dólares por hectárea.'}
              {unidadArr === 'pct_produccion' && 'Porcentaje del ingreso bruto del lote.'}
            </p>
          </motion.div>
        )}

        <div className="pt-2 flex justify-end gap-2 border-t border-border mt-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// formatearUsd not used directly here; kept import in case future enhancement.
void formatearUsd;
