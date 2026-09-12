import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart3, CalendarRange } from 'lucide-react';
import { campaniasService } from '@/services/campaniasService';
import { calculosService } from '@/services/calculosService';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedNumber } from '@/components/charts/AnimatedNumber';
import { formatearUsd, formatearHa } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const colorCultivo = (nombre: string) => {
  const map: Record<string, string> = {
    soja: '#A8B948', trigo: '#E8B53D', maíz: '#F2A03C',
    maiz: '#F2A03C', girasol: '#F4D03F', sorgo: '#B8482A',
  };
  return map[nombre.toLowerCase()] ?? '#047C00';
};

export function ResumenPage() {
  const [campaniaId, setCampaniaId] = useState<string>('');

  const { data: campanias } = useQuery({
    queryKey: ['campanias'],
    queryFn: () => campaniasService.listar({ limit: 100 }),
  });

  useEffect(() => {
    if (!campaniaId && campanias?.items[0]) {
      setCampaniaId(campanias.items[0].id);
    }
  }, [campanias, campaniaId]);

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['resumen', campaniaId],
    queryFn: () => calculosService.resumenCampania(campaniaId),
    enabled: !!campaniaId,
  });

  if (!campanias || campanias.items.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Sin campañas todavía"
        description="Creá una campaña y asignale lotes con cultivos para ver el resumen consolidado."
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Totales y comparativa por cultivo</p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Resumen de campaña</h1>
        </div>
        <select
          value={campaniaId}
          onChange={(e) => setCampaniaId(e.target.value)}
          className="w-full sm:w-auto h-10 px-3 rounded-md border border-border bg-surface text-sm"
        >
          {campanias.items.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>
          ))}
        </select>
      </header>

      {isLoading || !resumen ? (
        <div className="h-64 shimmer rounded-xl" />
      ) : resumen.cantidadLotes === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Esta campaña no tiene lotes"
          description="Asignale lotes desde la página de la campaña."
        />
      ) : (
        <>
          {/* Totales */}
          <div className="rounded-2xl bg-foreground text-background p-5 sm:p-6 lg:p-8">
            <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-background/65 font-semibold">
                  Totales consolidados
                </p>
                <h2 className="text-base sm:text-lg font-bold mt-1">
                  {resumen.cantidadLotes} lote{resumen.cantidadLotes === 1 ? '' : 's'} ·{' '}
                  <span className="tabular-nums">{formatearHa(resumen.totales.superficieHa)}</span>
                </h2>
              </div>
              {resumen.esProyeccion && (
                <span className="text-[10px] uppercase tracking-wider bg-warning/20 text-warning px-2 py-0.5 rounded-full font-semibold">
                  Proyectado
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Stat label="Ingreso bruto"   value={Number(resumen.totales.ingresoBruto)} />
              <Stat label="Costo total"     value={Number(resumen.totales.costoTotal)} />
              <Stat label="Margen neto"     value={Number(resumen.totales.margenNeto)} accent />
              <Stat label="Margen / ha"     value={Number(resumen.totales.margenNetoHa)} suffix=" /ha" accent />
            </div>
          </div>

          {/* Bar race por cultivo — comparativa */}
          <div className="rounded-2xl bg-surface border border-border p-6">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Margen neto por cultivo
            </p>
            <h3 className="text-lg font-bold text-foreground mb-4">Quién aporta más al resultado</h3>

            {resumen.porCultivo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            ) : (
              <ul className="space-y-4">
                {[...resumen.porCultivo]
                  .sort((a, b) => Number(b.margenNeto) - Number(a.margenNeto))
                  .map((c, i) => {
                    const maxAbs = Math.max(
                      ...resumen.porCultivo.map((x) => Math.abs(Number(x.margenNeto))),
                    );
                    const margen = Number(c.margenNeto);
                    const positivo = margen >= 0;
                    const pct = maxAbs > 0 ? (Math.abs(margen) / maxAbs) * 100 : 0;
                    const color = colorCultivo(c.cultivoNombre);
                    return (
                      <motion.li
                        key={c.cultivoId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="space-y-1.5"
                      >
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-sm shrink-0"
                              style={{ background: color }}
                            />
                            <span className="capitalize font-medium text-foreground truncate">{c.cultivoNombre}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">
                              · {c.cantidadLotes} lote{c.cantidadLotes === 1 ? '' : 's'}
                              · {formatearHa(c.superficieHa)}
                            </span>
                          </div>
                          <span className={cn(
                            'font-bold tabular-nums shrink-0',
                            positivo ? 'text-foreground' : 'text-destructive',
                          )}>
                            {formatearUsd(margen)}
                          </span>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: 'easeOut' }}
                            className={cn(
                              'absolute top-0 bottom-0',
                              positivo ? '' : 'right-0',
                            )}
                            style={positivo ? { left: 0, background: color } : { right: 0, background: '#DC2626' }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Margen/ha: {formatearUsd(c.margenNetoHa)} · Ingreso: {formatearUsd(c.ingresoBruto)} · Costo: {formatearUsd(c.costoTotal)}
                        </p>
                      </motion.li>
                    );
                  })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, suffix, accent }: { label: string; value: number; suffix?: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-background/65 font-semibold">{label}</p>
      <p className={cn('display-number text-2xl mt-1 tabular-nums', accent ? 'text-primary' : 'text-background')}>
        <AnimatedNumber value={value} decimals={0} prefix="USD " suffix={suffix} />
      </p>
    </div>
  );
}
