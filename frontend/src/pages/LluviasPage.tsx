import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  CloudRain, Droplets, Calendar as CalendarIcon, Loader2, Trash2, Sparkles, RefreshCw, Bot,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeatmapLluvias } from '@/components/charts/HeatmapLluvias';
import { AnimatedNumber } from '@/components/charts/AnimatedNumber';
import { lluviasService } from '@/services/lluviasService';
import { climaService } from '@/services/climaService';
import { establecimientosService } from '@/services/establecimientosService';
import { extraerMensajeError } from '@/lib/apiClient';
import { formatearFecha } from '@/utils/formatters';
import type { Establecimiento } from '@/types/agro';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const schema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mm: z.coerce.number().nonnegative('Debe ser >= 0'),
  nota: z.string().trim().optional(),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

export function LluviasPage() {
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [estabFiltro, setEstabFiltro] = useState<string>('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);

  const { data: establecimientos } = useQuery({
    queryKey: ['establecimientos'],
    queryFn: () => establecimientosService.listar({ limit: 100 }),
  });

  const { data: registros, isLoading: loadingRegistros } = useQuery({
    queryKey: ['lluvias', anio, estabFiltro || null],
    queryFn: () => lluviasService.listar(anio, estabFiltro || undefined),
  });

  const { data: resumen } = useQuery({
    queryKey: ['lluvias-resumen', anio, estabFiltro || null],
    queryFn: () => lluviasService.resumen(anio, estabFiltro || undefined),
  });

  const mapa = useMemo(() => {
    const m = new Map<string, number>();
    registros?.forEach((r) => {
      const fechaIso = r.fecha.slice(0, 10);
      m.set(fechaIso, (m.get(fechaIso) ?? 0) + Number(r.mm));
    });
    return m;
  }, [registros]);

  const aniosDisponibles = useMemo(() => {
    const lista = new Set<number>([ahora.getFullYear()]);
    registros?.forEach((r) => lista.add(new Date(r.fecha).getUTCFullYear()));
    // sumar 2 años anteriores y el siguiente para que pueda navegar
    for (let i = 1; i <= 3; i += 1) lista.add(ahora.getFullYear() - i);
    return Array.from(lista).sort((a, b) => b - a);
  }, [registros, ahora]);

  const total = Number(resumen?.total ?? 0);
  const diasConLluvia = resumen?.diasConLluvia ?? 0;
  const maxDia = Number(resumen?.maxDia ?? 0);
  const promedio = Number(resumen?.promedioPorDiaConLluvia ?? 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="space-y-3">
        <div className="flex items-start sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Calendario anual del campo</p>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Lluvias</h1>
          </div>
          <SyncButton />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
          >
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {establecimientos && establecimientos.items.length > 0 && (
            <select
              value={estabFiltro}
              onChange={(e) => setEstabFiltro(e.target.value)}
              className="h-10 px-3 rounded-md border border-border bg-surface text-sm flex-1 sm:flex-none"
            >
              <option value="">Toda la cuenta</option>
              {establecimientos.items.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total del año"
          value={total}
          decimals={1}
          suffix=" mm"
          icon={CloudRain}
          color="primary"
        />
        <StatCard
          label="Días con lluvia"
          value={diasConLluvia}
          decimals={0}
          icon={CalendarIcon}
          color="accent"
        />
        <StatCard
          label="Máximo en un día"
          value={maxDia}
          decimals={1}
          suffix=" mm"
          icon={Droplets}
          color="info"
        />
        <StatCard
          label="Promedio por día"
          value={promedio}
          decimals={1}
          suffix=" mm"
          icon={Droplets}
          color="muted"
        />
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl bg-surface border border-border p-4 sm:p-6">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <h2 className="font-semibold text-foreground">Calendario {anio}</h2>
            <p className="text-xs text-muted-foreground">
              Tocá un día para registrar mm. El verde se hace más intenso cuanto más llovió.
            </p>
          </div>
          <Button onClick={() => setFechaSeleccionada(new Date().toISOString().slice(0, 10))}>
            Registrar lluvia de hoy
          </Button>
        </div>

        {loadingRegistros ? (
          <div className="h-32 shimmer rounded-lg" />
        ) : (
          <HeatmapLluvias anio={anio} registros={mapa} onSelectDay={setFechaSeleccionada} />
        )}
      </div>

      {/* Bar chart por mes */}
      <div className="rounded-2xl bg-surface border border-border p-4 sm:p-6">
        <h2 className="font-semibold text-foreground mb-1">Acumulado por mes</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Comparación de los milímetros caídos cada mes del año.
        </p>
        {!resumen || resumen.porMes.every((m) => Number(m.mm) === 0) ? (
          <EmptyState
            icon={CloudRain}
            title="Sin registros para este año"
            description="Tocá un día del calendario o el botón de hoy para empezar a registrar."
          />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resumen.porMes.map((m) => ({ mes: MESES[m.mes - 1], mm: Number(m.mm), dias: m.dias }))}>
                <XAxis dataKey="mes" stroke="#5B6B5C" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#5B6B5C" fontSize={11} tickLine={false} axisLine={false} unit="mm" width={48} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.96)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#FFF',
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'rgba(4, 124, 0, 0.08)' }}
                  formatter={(value, _name, item) => {
                    const dias = (item.payload as { dias: number }).dias;
                    return [`${Number(value).toFixed(1)} mm · ${dias} día${dias === 1 ? '' : 's'}`, ''];
                  }}
                />
                <Bar dataKey="mm" radius={[6, 6, 0, 0]} animationDuration={700}>
                  {resumen.porMes.map((_, i) => (
                    <Cell key={i} fill="#047C00" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <LluviaSheet
        open={!!fechaSeleccionada}
        fecha={fechaSeleccionada}
        establecimientoId={estabFiltro || null}
        establecimiento={establecimientos?.items.find((e) => e.id === estabFiltro)}
        registroExistente={
          fechaSeleccionada
            ? registros?.find((r) => r.fecha.slice(0, 10) === fechaSeleccionada && (r.establecimientoId ?? '') === (estabFiltro || ''))
            : undefined
        }
        onClose={() => setFechaSeleccionada(null)}
      />
    </div>
  );
}

function SyncButton() {
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: () => lluviasService.sincronizar(30),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['lluvias'] });
      qc.invalidateQueries({ queryKey: ['lluvias-resumen'] });
      if (r.procesados === 0) {
        toast.warning('Ningún establecimiento tiene coordenadas cargadas todavía');
      } else {
        toast.success(
          `Sincronizado: ${r.creados} nuevos, ${r.actualizados} actualizados${r.saltadosPorManual > 0 ? `, ${r.saltadosPorManual} respetados (manual)` : ''}`,
        );
      }
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  return (
    <Button
      variant="outline"
      onClick={() => sync.mutate()}
      disabled={sync.isPending}
      className="shrink-0"
      title="Trae los mm de los últimos 30 días de Open-Meteo. Respeta lo que cargaste a mano."
    >
      {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      <span className="hidden sm:inline">Sincronizar</span>
    </Button>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  decimals: number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'accent' | 'info' | 'muted';
}
function StatCard({ label, value, decimals, suffix, icon: Icon, color }: StatCardProps) {
  const bgMap = { primary: 'bg-primary/10', accent: 'bg-accent/10', info: 'bg-info/10', muted: 'bg-muted' };
  const textMap = { primary: 'text-primary', accent: 'text-accent', info: 'text-info', muted: 'text-muted-foreground' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface border border-border p-4 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${bgMap[color]}`}>
          <Icon className={`h-3.5 w-3.5 ${textMap[color]}`} />
        </span>
      </div>
      <p className="display-number text-2xl sm:text-3xl text-foreground mt-2 tabular-nums">
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </p>
    </motion.div>
  );
}

function LluviaSheet({
  open,
  fecha,
  establecimientoId,
  establecimiento,
  registroExistente,
  onClose,
}: {
  open: boolean;
  fecha: string | null;
  establecimientoId: string | null;
  establecimiento?: Establecimiento;
  registroExistente?: ReturnType<typeof lluviasService.listar> extends Promise<(infer T)[]> ? T : never;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!registroExistente;

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    values: {
      fecha: fecha ?? '',
      mm: registroExistente ? Number(registroExistente.mm) : undefined,
      nota: registroExistente?.nota ?? '',
    },
  });

  // Botón "Importar de Open-Meteo": pide al backend el dato histórico de ese día
  // si el establecimiento tiene coordenadas cargadas. Pre-rellena el campo mm.
  const [importando, setImportando] = useState(false);
  const puedeImportar = !!(fecha && establecimiento?.latitud && establecimiento?.longitud);

  const importarOpenMeteo = async () => {
    if (!puedeImportar) return;
    setImportando(true);
    try {
      const r = await climaService.historico(
        Number(establecimiento!.latitud),
        Number(establecimiento!.longitud),
        fecha!,
        fecha!,
      );
      const dia = r.dias[0];
      if (dia) {
        setValue('mm', dia.lluvia);
        toast.success(`Open-Meteo: ${dia.lluvia.toFixed(1)} mm ese día`);
      } else {
        toast.message('Sin datos de Open-Meteo para esa fecha');
      }
    } catch (e) {
      toast.error(extraerMensajeError(e));
    } finally {
      setImportando(false);
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      lluviasService.registrar({
        fecha: data.fecha,
        mm: data.mm,
        establecimientoId: establecimientoId ?? undefined,
        nota: data.nota,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lluvias'] });
      qc.invalidateQueries({ queryKey: ['lluvias-resumen'] });
      toast.success('Registro guardado');
      reset();
      onClose();
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  const eliminar = useMutation({
    mutationFn: () => lluviasService.eliminar(registroExistente!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lluvias'] });
      qc.invalidateQueries({ queryKey: ['lluvias-resumen'] });
      toast.success('Registro eliminado');
      onClose();
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? 'Editar lluvia' : 'Registrar lluvia'}
      description={fecha ? formatearFecha(`${fecha}T00:00:00`) : undefined}
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <input type="hidden" {...register('fecha')} />

        {/* Origen del dato (badge si fue automatizado) */}
        {registroExistente?.origen === 'open_meteo' && (
          <div className="rounded-lg border border-info/30 bg-info/5 px-3 py-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-info shrink-0" />
            <p className="text-xs text-foreground">
              <strong>Importado automáticamente</strong> de Open-Meteo. Si tu pluviómetro marcó otra cosa, sobreescribilo guardando — quedará como manual.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="mm">Milímetros caídos *</Label>
            {puedeImportar && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={importarOpenMeteo}
                disabled={importando}
              >
                {importando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Importar de Open-Meteo
              </Button>
            )}
          </div>
          <div className="relative">
            <Input
              id="mm"
              type="number"
              step="0.1"
              min="0"
              autoFocus
              placeholder="Ej: 12.5"
              className="pr-12"
              {...register('mm', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">mm</span>
          </div>
          {errors.mm && <p className="text-xs text-destructive">{errors.mm.message}</p>}
          <p className="text-[11px] text-muted-foreground">
            Si no llovió pero querés dejarlo registrado como "controlado", poné 0.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nota">Nota</Label>
          <Input id="nota" placeholder="Opcional — ej: granizo en el sur" {...register('nota')} />
        </div>

        <div className="flex justify-between gap-2 border-t border-border pt-4 mt-4">
          {isEdit ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { if (confirm('¿Eliminar registro?')) eliminar.mutate(); }}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar' : 'Registrar'}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
