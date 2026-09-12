import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Plus, Trash2, Loader2, Sprout, Beaker, ClipboardList, Tractor as TractorIcon, Pencil,
} from 'lucide-react';
import { EditarInsumoSheet } from '@/components/insumos/EditarInsumoSheet';
import { EditarLaborSheet } from '@/components/labores/EditarLaborSheet';
import type { Labor, InsumoAplicado } from '@/types/agro';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/Sheet';
import { lotesCampaniaService } from '@/services/lotesCampaniaService';
import { calculosService } from '@/services/calculosService';
import { laboresService } from '@/services/laboresService';
import { insumosAplicadosService } from '@/services/insumosAplicadosService';
import { extraerMensajeError } from '@/lib/apiClient';
import { formatearFecha, formatearHa, formatearQqHa, formatearUsd } from '@/utils/formatters';
import { AnimatedNumber } from '@/components/charts/AnimatedNumber';
import { CostDonut } from '@/components/charts/CostDonut';
import { ThermometerEquilibrium } from '@/components/charts/ThermometerEquilibrium';
import { cn } from '@/lib/utils';
import type { FormaPago, TipoInsumo, TipoLabor } from '@/types/agro';

const colorCultivo = (nombre: string) => {
  const map: Record<string, string> = {
    soja: '#A8B948', trigo: '#E8B53D', maíz: '#F2A03C',
    maiz: '#F2A03C', girasol: '#F4D03F', sorgo: '#B8482A',
  };
  return map[nombre.toLowerCase()] ?? '#047C00';
};

const LABORES_TIPOS: { value: TipoLabor; label: string }[] = [
  { value: 'siembra',        label: 'Siembra' },
  { value: 'pulverizacion',  label: 'Pulverización' },
  { value: 'fertilizacion',  label: 'Fertilización' },
  { value: 'cosecha',        label: 'Cosecha' },
  { value: 'otra',           label: 'Otra' },
];

const INSUMOS_TIPOS: { value: TipoInsumo; label: string }[] = [
  { value: 'semilla',      label: 'Semilla' },
  { value: 'fertilizante', label: 'Fertilizante' },
  { value: 'herbicida',    label: 'Herbicida' },
  { value: 'insecticida',  label: 'Insecticida' },
  { value: 'fungicida',    label: 'Fungicida' },
  { value: 'otro',         label: 'Otro' },
];

export function LoteCampaniaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'resultado' | 'labores' | 'insumos'>('resultado');
  const [creating, setCreating] = useState<'labor' | 'insumo' | null>(null);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [editandoLabor, setEditandoLabor] = useState<Labor | null>(null);
  const [editandoInsumo, setEditandoInsumo] = useState<InsumoAplicado | null>(null);

  const { data: lc, isLoading } = useQuery({
    queryKey: ['lote-campania', id],
    queryFn: () => lotesCampaniaService.obtener(id!),
    enabled: !!id,
  });

  const { data: resultado } = useQuery({
    queryKey: ['resultado', id],
    queryFn: () => calculosService.resultadoLote(id!),
    enabled: !!id,
  });

  const eliminarLabor = useMutation({
    mutationFn: (laborId: string) => laboresService.eliminar(laborId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-campania', id] });
      qc.invalidateQueries({ queryKey: ['resultado', id] });
      toast.success('Labor eliminada');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });
  const eliminarInsumo = useMutation({
    mutationFn: (insId: string) => insumosAplicadosService.eliminar(insId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-campania', id] });
      qc.invalidateQueries({ queryKey: ['resultado', id] });
      toast.success('Insumo eliminado');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  if (isLoading || !lc) {
    return <div className="space-y-3"><div className="h-24 shimmer rounded-xl" /><div className="h-64 shimmer rounded-xl" /></div>;
  }

  const color = colorCultivo(lc.cultivo?.nombre ?? '');
  const r = resultado;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link
        to={`/campanias/${lc.campaniaId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a la campaña
      </Link>

      {/* Hero */}
      <header
        className="rounded-2xl p-5 sm:p-6 lg:p-8 text-white relative overflow-hidden shadow-glass"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)` }}
      >
        <div className="absolute right-2 sm:right-4 top-2 sm:top-4 opacity-15 pointer-events-none">
          <Sprout className="w-32 sm:w-44 h-32 sm:h-44" />
        </div>
        <div className="relative">
          <p className="text-[11px] uppercase tracking-widest text-white/75 font-medium">
            {lc.campania?.nombre} · {lc.lote?.establecimiento?.nombre}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">{lc.lote?.nombre}</h1>
            <button
              onClick={() => setEditandoDatos(true)}
              className="h-9 px-3 rounded-md bg-white/15 hover:bg-white/25 text-white text-xs font-medium inline-flex items-center gap-1.5 backdrop-blur-sm transition shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar datos
            </button>
          </div>
          <p className="text-xs sm:text-sm text-white/85 mt-1 capitalize">
            {lc.cultivo?.nombre} · {formatearHa(lc.superficieSembradaHa)}
            {lc.fechaSiembra && ` · sembrado el ${formatearFecha(lc.fechaSiembra)}`}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 max-w-2xl">
            <HeroStat
              label="Rinde"
              value={lc.rindeRealQqHa ? formatearQqHa(lc.rindeRealQqHa) : (lc.rindeEstimadoQqHa ? formatearQqHa(lc.rindeEstimadoQqHa) : '—')}
              hint={lc.rindeRealQqHa ? 'Real' : 'Estimado'}
            />
            <HeroStat
              label="Precio"
              value={lc.precioGranoUsdTn ? `${formatearUsd(lc.precioGranoUsdTn)}/tn` : '—'}
            />
            <HeroStat
              label={r?.esProyeccion ? 'Margen proyectado' : 'Margen neto'}
              value={r ? `${formatearUsd(r.margenes.neto)}` : '—'}
              big
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/60 w-full sm:w-fit overflow-x-auto">
        {[
          { key: 'resultado' as const, label: 'Resultado', icon: TractorIcon },
          { key: 'labores' as const,    label: 'Labores',    icon: ClipboardList },
          { key: 'insumos' as const,    label: 'Insumos',    icon: Beaker },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5',
              tab === t.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === t.key && (
              <motion.div
                layoutId="tab-active"
                className="absolute inset-0 bg-surface rounded-lg shadow-sm"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <t.icon className="h-3.5 w-3.5 relative" />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Resultado */}
      {tab === 'resultado' && (
        <ResultadoSection resultado={r} />
      )}

      {/* Labores */}
      {tab === 'labores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {lc.labores?.length ?? 0} labor{(lc.labores?.length ?? 0) === 1 ? '' : 'es'} registrada{(lc.labores?.length ?? 0) === 1 ? '' : 's'}
            </p>
            <Button onClick={() => setCreating('labor')}>
              <Plus className="h-4 w-4" /> Nueva labor
            </Button>
          </div>

          {(!lc.labores || lc.labores.length === 0) ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Sin labores cargadas todavía.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lc.labores.map((labor) => (
                <li key={labor.id} className="group rounded-xl bg-surface border border-border p-4 hover:border-primary/40 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">{labor.tipo}</span>
                      <p className="text-sm text-foreground mt-0.5">{formatearFecha(labor.fecha)} · {labor.ejecutor}</p>
                      {labor.nota && <p className="text-xs text-muted-foreground mt-1">{labor.nota}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {labor.costoTotalUsd ? formatearUsd(labor.costoTotalUsd) : '—'}
                      </p>
                      {labor.formaPago && <p className="text-[10px] text-muted-foreground uppercase">{labor.formaPago}</p>}
                    </div>
                  </div>
                  <div className="mt-2 lg:opacity-0 lg:group-hover:opacity-100 flex items-center gap-3 transition">
                    <button
                      onClick={() => setEditandoLabor(labor as Labor)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar labor?')) eliminarLabor.mutate(labor.id); }}
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Insumos */}
      {tab === 'insumos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {lc.insumosAplicados?.length ?? 0} insumo{(lc.insumosAplicados?.length ?? 0) === 1 ? '' : 's'} aplicado{(lc.insumosAplicados?.length ?? 0) === 1 ? '' : 's'}
            </p>
            <Button onClick={() => setCreating('insumo')}>
              <Plus className="h-4 w-4" /> Nuevo insumo
            </Button>
          </div>

          {(!lc.insumosAplicados || lc.insumosAplicados.length === 0) ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Beaker className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Sin insumos cargados todavía.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lc.insumosAplicados.map((ins) => (
                <li key={ins.id} className="group rounded-xl bg-surface border border-border p-4 hover:border-primary/40 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">{ins.tipo}</span>
                      <p className="text-sm font-semibold text-foreground">{ins.producto}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Number(ins.cantidad).toLocaleString('es-AR')} {ins.unidad}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">{formatearUsd(ins.costoTotalUsd)}</p>
                      {ins.formaPago && <p className="text-[10px] text-muted-foreground uppercase">{ins.formaPago}</p>}
                    </div>
                  </div>
                  <div className="mt-2 lg:opacity-0 lg:group-hover:opacity-100 flex items-center gap-3 transition">
                    <button
                      onClick={() => setEditandoInsumo(ins as InsumoAplicado)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar insumo?')) eliminarInsumo.mutate(ins.id); }}
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <LaborSheet
        open={creating === 'labor'}
        loteCampaniaId={id!}
        onClose={() => setCreating(null)}
      />
      <InsumoSheet
        open={creating === 'insumo'}
        loteCampaniaId={id!}
        onClose={() => setCreating(null)}
      />
      <EditarDatosSheet
        open={editandoDatos}
        loteCampaniaId={id!}
        valores={{
          superficieSembradaHa: Number(lc.superficieSembradaHa),
          fechaSiembra: lc.fechaSiembra?.slice(0, 10) ?? null,
          rindeEstimadoQqHa: lc.rindeEstimadoQqHa ? Number(lc.rindeEstimadoQqHa) : null,
          rindeRealQqHa: lc.rindeRealQqHa ? Number(lc.rindeRealQqHa) : null,
          precioGranoUsdTn: lc.precioGranoUsdTn ? Number(lc.precioGranoUsdTn) : null,
          fechaCosecha: lc.fechaCosecha?.slice(0, 10) ?? null,
        }}
        onClose={() => setEditandoDatos(false)}
      />
      <EditarLaborSheet
        open={!!editandoLabor}
        labor={editandoLabor}
        onClose={() => setEditandoLabor(null)}
      />
      <EditarInsumoSheet
        open={!!editandoInsumo}
        insumo={editandoInsumo}
        onClose={() => setEditandoInsumo(null)}
      />
    </div>
  );
}

function HeroStat({ label, value, hint, big }: { label: string; value: string; hint?: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">{label}</p>
      <p className={cn('text-white font-bold tabular-nums leading-tight', big ? 'text-2xl' : 'text-lg')}>
        {value}
      </p>
      {hint && <p className="text-[10px] text-white/65 uppercase mt-0.5">{hint}</p>}
    </div>
  );
}

function ResultadoSection({ resultado }: { resultado: ReturnType<typeof calculosService.resultadoLote> extends Promise<infer T> ? T | undefined : never }) {
  if (!resultado) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Cargá rinde estimado, precio del grano y al menos una labor o insumo para calcular el resultado.
        </p>
      </div>
    );
  }

  const r = resultado;
  const rinde = Number(r.rinde);
  const equilibrio = Number(r.puntoEquilibrio.rindeQqHa);

  const segmentos = [
    { nombre: 'Insumos',       valor: Number(r.costos.insumos),       color: '#047C00' },
    { nombre: 'Labores',       valor: Number(r.costos.labores),       color: '#0F7702' },
    { nombre: 'Arrendamiento', valor: Number(r.costos.arrendamiento), color: '#E8B53D' },
  ].filter((s) => s.valor > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Termómetro del punto de equilibrio — HERO */}
      <div className="col-span-1 lg:col-span-2 rounded-2xl bg-surface border border-border p-6">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Punto de equilibrio
            </p>
            <h3 className="text-xl font-bold text-foreground">¿Cuánto necesitás cosechar para no perder?</h3>
          </div>
          {r.esProyeccion && (
            <span className="text-[10px] uppercase tracking-wider bg-warning/15 text-warning px-2 py-0.5 rounded-full font-semibold">
              Proyectado
            </span>
          )}
        </div>
        <div className="pt-6">
          <ThermometerEquilibrium rindeActual={rinde} rindeEquilibrio={equilibrio} />
        </div>
      </div>

      {/* Donut de composición de costos */}
      <div className="rounded-2xl bg-surface border border-border p-6">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          Composición de costos
        </p>
        <h3 className="font-bold text-foreground mb-4">Total USD {Number(r.costos.total).toLocaleString('es-AR')}</h3>
        {segmentos.length > 0 ? (
          <CostDonut
            data={segmentos}
            size={170}
            centerValue={formatearUsd(Number(r.costos.totalHa)).split(',')[0] + '/ha'}
            centerLabel="USD/ha"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Sin costos cargados.</p>
        )}
      </div>

      {/* Resumen numérico */}
      <div className="col-span-1 lg:col-span-3 rounded-2xl bg-foreground text-background p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <BigNum label="Ingreso bruto" value={Number(r.ingresoBruto)} prefix="USD " />
          <BigNum label="Costo total" value={Number(r.costos.total)} prefix="USD " />
          <BigNum label="Margen neto" value={Number(r.margenes.neto)} prefix="USD " accent />
          <BigNum label="Margen / ha" value={Number(r.margenes.netoHa)} prefix="USD " suffix=" /ha" accent />
        </div>
        <p className="text-xs text-background/60 mt-4 italic">{r.puntoEquilibrio.lectura}</p>
      </div>
    </div>
  );
}

function BigNum({ label, value, prefix, suffix, accent }: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-background/65 font-semibold">{label}</p>
      <p className={cn('display-number text-2xl mt-1', accent ? 'text-primary' : 'text-background')}>
        <AnimatedNumber value={value} decimals={0} prefix={prefix} suffix={suffix} />
      </p>
    </div>
  );
}

// ============================================================
// Labor Sheet
// ============================================================
const laborSchema = z.object({
  tipo: z.enum(['siembra', 'pulverizacion', 'fertilizacion', 'cosecha', 'otra']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ejecutor: z.enum(['propio', 'contratista']),
  costoTotalUsd: z.coerce.number().nonnegative().optional(),
  formaPago: z.enum(['contado', 'canje', 'financiado']).optional(),
  nota: z.string().optional(),
});
type LaborFormInput = z.input<typeof laborSchema>;
type LaborForm = z.output<typeof laborSchema>;

function LaborSheet({ open, loteCampaniaId, onClose }: { open: boolean; loteCampaniaId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<LaborFormInput, unknown, LaborForm>({
    resolver: zodResolver(laborSchema),
    defaultValues: { tipo: 'pulverizacion', fecha: today, ejecutor: 'contratista' },
  });
  const tipo = watch('tipo');
  const ejecutor = watch('ejecutor');
  const formaPago = watch('formaPago');

  const mutation = useMutation({
    mutationFn: (data: LaborForm) =>
      laboresService.crear({
        loteCampaniaId,
        tipo: data.tipo,
        fecha: data.fecha,
        ejecutor: data.ejecutor,
        ...(data.costoTotalUsd !== undefined ? { costoTotalUsd: data.costoTotalUsd } : {}),
        ...(data.formaPago ? { formaPago: data.formaPago } : {}),
        ...(data.nota ? { nota: data.nota } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-campania', loteCampaniaId] });
      qc.invalidateQueries({ queryKey: ['resultado', loteCampaniaId] });
      toast.success('Labor registrada');
      reset({ tipo: 'pulverizacion', fecha: today, ejecutor: 'contratista' });
      onClose();
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Nueva labor">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de labor</Label>
          <div className="flex flex-wrap gap-2">
            {LABORES_TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setValue('tipo', t.value, { shouldValidate: true })}
                className={cn(
                  'h-9 px-3 rounded-full border text-sm font-medium transition',
                  tipo === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface hover:border-primary/40',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lf">Fecha</Label>
            <Input id="lf" type="date" {...register('fecha')} />
            {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Ejecutor</Label>
            <div className="grid grid-cols-2 gap-1">
              {(['propio', 'contratista'] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setValue('ejecutor', e)}
                  className={cn(
                    'h-10 rounded-md border text-sm font-medium capitalize transition',
                    ejecutor === e ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lc">Costo total (USD)</Label>
            <Input id="lc" type="number" step="0.01" min="0" placeholder="—"
              {...register('costoTotalUsd', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
          </div>
          <div className="space-y-2">
            <Label>Forma de pago</Label>
            <div className="grid grid-cols-3 gap-1">
              {(['contado', 'canje', 'financiado'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setValue('formaPago', formaPago === p ? undefined : p)}
                  className={cn(
                    'h-10 rounded-md border text-xs font-medium capitalize transition',
                    formaPago === p ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ln">Nota</Label>
          <Input id="ln" placeholder="Opcional" {...register('nota')} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// ============================================================
// Insumo Sheet
// ============================================================
const insumoSchema = z.object({
  tipo: z.enum(['semilla', 'fertilizante', 'herbicida', 'insecticida', 'fungicida', 'otro']),
  producto: z.string().min(1, 'Requerido'),
  cantidad: z.coerce.number().positive(),
  unidad: z.string().min(1, 'Requerido'),
  costoTotalUsd: z.coerce.number().nonnegative(),
  formaPago: z.enum(['contado', 'canje', 'financiado']).optional(),
});
type InsumoFormInput = z.input<typeof insumoSchema>;
type InsumoForm = z.output<typeof insumoSchema>;

const UNIDADES_INSUMO = ['lt', 'kg', 'bolsa', 'sem/ha', 'gr/ha'];

function InsumoSheet({ open, loteCampaniaId, onClose }: { open: boolean; loteCampaniaId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<InsumoFormInput, unknown, InsumoForm>({
    resolver: zodResolver(insumoSchema),
    defaultValues: { tipo: 'herbicida', unidad: 'lt' },
  });
  const tipo = watch('tipo');
  const unidad = watch('unidad');
  const formaPago = watch('formaPago');

  const mutation = useMutation({
    mutationFn: (data: InsumoForm) =>
      insumosAplicadosService.crear({
        loteCampaniaId,
        tipo: data.tipo as TipoInsumo,
        producto: data.producto,
        cantidad: data.cantidad,
        unidad: data.unidad,
        costoTotalUsd: data.costoTotalUsd,
        ...(data.formaPago ? { formaPago: data.formaPago as FormaPago } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-campania', loteCampaniaId] });
      qc.invalidateQueries({ queryKey: ['resultado', loteCampaniaId] });
      toast.success('Insumo registrado');
      reset({ tipo: 'herbicida', unidad: 'lt' });
      onClose();
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Nuevo insumo aplicado">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <div className="flex flex-wrap gap-2">
            {INSUMOS_TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setValue('tipo', t.value, { shouldValidate: true })}
                className={cn(
                  'h-9 px-3 rounded-full border text-sm font-medium transition',
                  tipo === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface hover:border-primary/40',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prod">Producto *</Label>
          <Input id="prod" placeholder="Ej: Glifosato 48%" {...register('producto')} />
          {errors.producto && <p className="text-xs text-destructive">{errors.producto.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cant">Cantidad *</Label>
            <Input id="cant" type="number" step="0.01" min="0"
              {...register('cantidad', { setValueAs: (v) => v === '' ? 0 : Number(v) })} />
            {errors.cantidad && <p className="text-xs text-destructive">{errors.cantidad.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Unidad</Label>
            <div className="grid grid-cols-3 gap-1">
              {UNIDADES_INSUMO.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setValue('unidad', u, { shouldValidate: true })}
                  className={cn(
                    'h-10 rounded-md border text-xs font-medium transition',
                    unidad === u ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ic">Costo total (USD) *</Label>
            <Input id="ic" type="number" step="0.01" min="0"
              {...register('costoTotalUsd', { setValueAs: (v) => v === '' ? 0 : Number(v) })} />
            {errors.costoTotalUsd && <p className="text-xs text-destructive">{errors.costoTotalUsd.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Forma de pago</Label>
            <div className="grid grid-cols-3 gap-1">
              {(['contado', 'canje', 'financiado'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setValue('formaPago', formaPago === p ? undefined : p)}
                  className={cn(
                    'h-10 rounded-md border text-xs font-medium capitalize transition',
                    formaPago === p ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// ============================================================
// Editar datos del lote-campaña (rinde, precio, fechas)
// ============================================================
const editarDatosSchema = z.object({
  superficieSembradaHa: z.coerce.number().positive('Debe ser > 0').max(100000),
  fechaSiembra: z.string().optional().or(z.literal('')),
  rindeEstimadoQqHa: z.coerce
    .number()
    .nonnegative()
    .max(1000, 'Inusualmente alto — la unidad es qq/ha')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  rindeRealQqHa: z.coerce
    .number()
    .nonnegative()
    .max(1000, 'Inusualmente alto — la unidad es qq/ha')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  precioGranoUsdTn: z.coerce
    .number()
    .positive()
    .max(5000, 'Inusualmente alto — la unidad es USD por TONELADA, no por quintal')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  fechaCosecha: z.string().optional().or(z.literal('')),
});
type EditarDatosInput = z.input<typeof editarDatosSchema>;
type EditarDatosForm = z.output<typeof editarDatosSchema>;

interface ValoresIniciales {
  superficieSembradaHa: number;
  fechaSiembra: string | null;
  rindeEstimadoQqHa: number | null;
  rindeRealQqHa: number | null;
  precioGranoUsdTn: number | null;
  fechaCosecha: string | null;
}

function EditarDatosSheet({
  open,
  loteCampaniaId,
  valores,
  onClose,
}: {
  open: boolean;
  loteCampaniaId: string;
  valores: ValoresIniciales;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<EditarDatosInput, unknown, EditarDatosForm>({
    resolver: zodResolver(editarDatosSchema),
    values: {
      superficieSembradaHa: valores.superficieSembradaHa,
      fechaSiembra: valores.fechaSiembra ?? '',
      rindeEstimadoQqHa: valores.rindeEstimadoQqHa ?? undefined,
      rindeRealQqHa: valores.rindeRealQqHa ?? undefined,
      precioGranoUsdTn: valores.precioGranoUsdTn ?? undefined,
      fechaCosecha: valores.fechaCosecha ?? '',
    },
  });

  const precioObs = Number(watch('precioGranoUsdTn') ?? 0) || 0;
  const rindeEstObs = Number(watch('rindeEstimadoQqHa') ?? 0) || 0;
  const supObs = Number(watch('superficieSembradaHa') ?? 0) || 0;
  const ingresoEstimado = (rindeEstObs * supObs / 10) * precioObs;
  const precioInusual = precioObs > 1000;

  const mutation = useMutation({
    mutationFn: (data: EditarDatosForm) =>
      lotesCampaniaService.actualizar(loteCampaniaId, {
        superficieSembradaHa: data.superficieSembradaHa,
        fechaSiembra: data.fechaSiembra || null,
        rindeEstimadoQqHa: data.rindeEstimadoQqHa ?? null,
        rindeRealQqHa: data.rindeRealQqHa ?? null,
        precioGranoUsdTn: data.precioGranoUsdTn ?? null,
        fechaCosecha: data.fechaCosecha || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-campania', loteCampaniaId] });
      qc.invalidateQueries({ queryKey: ['resultado', loteCampaniaId] });
      qc.invalidateQueries({ queryKey: ['lotes-campania'] });
      toast.success('Datos actualizados');
      onClose();
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Editar datos del lote en la campaña"
      description="Modificá superficie, fechas, rinde o precio. El resultado se recalcula automáticamente."
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="sup">Superficie sembrada (ha) *</Label>
            <Input id="sup" type="number" step="0.01" min="0"
              {...register('superficieSembradaHa', { setValueAs: (v) => (v === '' ? 0 : Number(v)) })} />
            {errors.superficieSembradaHa && <p className="text-xs text-destructive">{errors.superficieSembradaHa.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fs">Fecha siembra</Label>
            <Input id="fs" type="date" {...register('fechaSiembra')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="re">Rinde estimado (qq/ha)</Label>
            <Input id="re" type="number" step="0.1" min="0" placeholder="Ej: 38"
              {...register('rindeEstimadoQqHa', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
            {errors.rindeEstimadoQqHa && <p className="text-xs text-destructive">{errors.rindeEstimadoQqHa.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rr">Rinde real (qq/ha)</Label>
            <Input id="rr" type="number" step="0.1" min="0" placeholder="Si ya cosechaste"
              {...register('rindeRealQqHa', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
            {errors.rindeRealQqHa && <p className="text-xs text-destructive">{errors.rindeRealQqHa.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="p">Precio del grano (USD por tonelada)</Label>
          <div className="relative">
            <Input id="p" type="number" step="0.01" min="0" placeholder="Ej: soja 320, maíz 220, trigo 250"
              className="pr-16"
              {...register('precioGranoUsdTn', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">USD/tn</span>
          </div>
          {errors.precioGranoUsdTn && <p className="text-xs text-destructive">{errors.precioGranoUsdTn.message}</p>}
          {precioInusual && !errors.precioGranoUsdTn && (
            <p className="text-xs text-warning bg-warning/5 border border-warning/30 rounded px-2 py-1.5">
              ⚠️ <strong>{precioObs.toLocaleString('es-AR')} USD/tn</strong> es muy alto. Los granos suelen estar entre 100 y 500 USD/tn.
              {' '}¿Quizás querías ingresar el precio en pesos o por quintal?
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Referencia 2026: soja ~280–350, maíz ~180–260, trigo ~220–280, girasol ~320–400.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fc">Fecha cosecha</Label>
          <Input id="fc" type="date" {...register('fechaCosecha')} />
        </div>

        {ingresoEstimado > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">Ingreso bruto estimado</p>
            <p className="display-number text-2xl text-foreground mt-0.5 tabular-nums">
              USD {ingresoEstimado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {(rindeEstObs * supObs / 10).toFixed(1)} tn × USD {precioObs.toLocaleString('es-AR')}/tn
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
