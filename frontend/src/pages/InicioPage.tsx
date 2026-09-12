import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sprout, Tractor, CalendarRange, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { establecimientosService } from '@/services/establecimientosService';
import { lotesService } from '@/services/lotesService';
import { lotesCampaniaService } from '@/services/lotesCampaniaService';
import { campaniasService } from '@/services/campaniasService';
import { AnimatedNumber } from '@/components/charts/AnimatedNumber';
import { Logo } from '@/components/layout/Logo';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

export function InicioPage() {
  const usuario = useAuthStore((s) => s.usuario);

  const { data: establecimientos } = useQuery({
    queryKey: ['establecimientos', { page: 1, limit: 100 }],
    queryFn: () => establecimientosService.listar({ limit: 100 }),
  });
  const { data: lotes } = useQuery({
    queryKey: ['lotes', { limit: 100 }],
    queryFn: () => lotesService.listar({ limit: 100 }),
  });
  const { data: lc } = useQuery({
    queryKey: ['lotes-campania', { limit: 100 }],
    queryFn: () => lotesCampaniaService.listar({ limit: 100 }),
  });
  const { data: campanias } = useQuery({
    queryKey: ['campanias', { limit: 100 }],
    queryFn: () => campaniasService.listar({ limit: 100 }),
  });

  const totalSuperficie = lotes?.items.reduce((s, l) => s + Number(l.superficieHa), 0) ?? 0;
  const totalEstablecimientos = establecimientos?.total ?? 0;
  const totalLotes = lotes?.total ?? 0;
  const totalCampanias = campanias?.total ?? 0;
  const lotesActivosCampania = lc?.total ?? 0;

  // Producción esperada total = sumar (rinde_estimado × superficie / 10) en toneladas
  const produccionTn = lc?.items.reduce((acc, x) => {
    const rinde = Number(x.rindeEstimadoQqHa ?? 0);
    const sup = Number(x.superficieSembradaHa ?? 0);
    return acc + (rinde * sup) / 10;
  }, 0) ?? 0;

  // Ingreso bruto proyectado
  const ingresoProyectado = lc?.items.reduce((acc, x) => {
    const rinde = Number(x.rindeEstimadoQqHa ?? 0);
    const sup = Number(x.superficieSembradaHa ?? 0);
    const precioTn = Number(x.precioGranoUsdTn ?? 0);
    return acc + ((rinde * sup) / 10) * precioTn;
  }, 0) ?? 0;

  // Distribución por cultivo
  const porCultivo = new Map<string, number>();
  lc?.items.forEach((x) => {
    const nombre = x.cultivo?.nombre ?? 'sin cultivo';
    const ha = Number(x.superficieSembradaHa);
    porCultivo.set(nombre, (porCultivo.get(nombre) ?? 0) + ha);
  });
  const cultivos = Array.from(porCultivo.entries())
    .map(([nombre, ha]) => ({ nombre, ha }))
    .sort((a, b) => b.ha - a.ha);

  const colorCultivo = (nombre: string) => {
    const map: Record<string, string> = {
      soja: '#A8B948', trigo: '#E8B53D', maíz: '#F2A03C',
      maiz: '#F2A03C', girasol: '#F4D03F', sorgo: '#B8482A',
    };
    return map[nombre.toLowerCase()] ?? '#047C00';
  };

  const item = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 260, damping: 28, delay },
  });

  return (
    <div className="flex-1 flex flex-col space-y-6 max-w-7xl w-full mx-auto">
      {/* Greeting */}
      <motion.div {...item(0)} className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hola, {usuario?.nombre?.split(' ')[0]} 👋</p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Tu vivero</h1>
        </div>
        <Logo size={36} animated />
      </motion.div>

      {/* Bento grid asimétrica — celdas más altas en desktop para ocupar el viewport */}
      <div className="flex-1 grid grid-cols-12 auto-rows-[140px] sm:auto-rows-[130px] lg:auto-rows-[160px] xl:auto-rows-[180px] gap-3 sm:gap-4">
        {/* Producción esperada — celda grande */}
        <motion.div
          {...item(0.05)}
          className="col-span-12 md:col-span-7 row-span-2 relative rounded-2xl overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-primary via-primary-light to-primary-deep text-primary-foreground shadow-glass"
        >
          <div className="absolute -right-12 -top-8 opacity-15">
            <Sprout className="w-56 h-56" />
          </div>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/75 font-medium">
                Producción esperada de campaña vigente
              </p>
              <div className="mt-3 flex items-end gap-2">
                <AnimatedNumber
                  value={produccionTn}
                  decimals={0}
                  className="display-number text-5xl lg:text-7xl text-white leading-none"
                />
                <span className="text-xl lg:text-2xl text-white/85 font-semibold pb-1">tn</span>
              </div>
              <p className="mt-2 text-sm text-white/80">
                Sobre {totalLotes > 0 ? `${totalLotes} lote${totalLotes === 1 ? '' : 's'}` : '— sin lotes cargados'} ·{' '}
                <AnimatedNumber value={totalSuperficie} decimals={0} suffix=" ha" />
              </p>
            </div>
            <div className="flex items-center justify-between mt-6">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-white/75">Ingreso proyectado</p>
                <p className="display-number text-2xl lg:text-3xl text-white mt-1">
                  <AnimatedNumber value={ingresoProyectado} decimals={0} prefix="USD " />
                </p>
              </div>
              <Link
                to="/resumen"
                className="text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 transition"
              >
                Ver resumen
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Lotes activos */}
        <motion.div
          {...item(0.1)}
          className="col-span-6 md:col-span-5 rounded-2xl bg-surface border border-border p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">En campaña</span>
            <Sprout className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="display-number text-3xl text-foreground">
              <AnimatedNumber value={lotesActivosCampania} />
              <span className="text-base text-muted-foreground ml-1">lotes</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">activos en campañas vigentes</p>
          </div>
        </motion.div>

        {/* Establecimientos */}
        <motion.div
          {...item(0.13)}
          className="col-span-6 md:col-span-3 rounded-2xl bg-surface border border-border p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Campos</span>
            <Tractor className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="display-number text-3xl text-foreground">
              <AnimatedNumber value={totalEstablecimientos} />
            </p>
            <Link to="/establecimientos" className="text-xs text-primary hover:underline">Gestionar →</Link>
          </div>
        </motion.div>

        {/* Campañas */}
        <motion.div
          {...item(0.16)}
          className="col-span-6 md:col-span-2 rounded-2xl bg-surface border border-border p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Campañas</span>
            <CalendarRange className="h-4 w-4 text-primary" />
          </div>
          <p className="display-number text-3xl text-foreground">
            <AnimatedNumber value={totalCampanias} />
          </p>
        </motion.div>

        {/* Distribución por cultivo */}
        <motion.div
          {...item(0.2)}
          className="col-span-12 md:col-span-7 row-span-2 rounded-2xl bg-surface border border-border p-6 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Mosaico de cultivos</h3>
              <p className="text-xs text-muted-foreground">Distribución de superficie sembrada por cultivo</p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>

          {cultivos.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              Asigná un cultivo a un lote en una campaña para verlo acá.
            </div>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="h-3 w-full rounded-full overflow-hidden bg-muted flex">
                {cultivos.map((c) => {
                  const pct = (c.ha / totalSuperficie) * 100;
                  return (
                    <motion.div
                      key={c.nombre}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                      style={{ background: colorCultivo(c.nombre) }}
                      title={`${c.nombre}: ${pct.toFixed(1)}%`}
                    />
                  );
                })}
              </div>

              {/* Tiles */}
              <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cultivos.slice(0, 6).map((c, i) => {
                  const pct = (c.ha / totalSuperficie) * 100;
                  return (
                    <motion.li
                      key={c.nombre}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.04 }}
                      className="relative rounded-xl border border-border p-3 overflow-hidden"
                    >
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{ background: colorCultivo(c.nombre) }}
                      />
                      <div className="relative">
                        <span
                          className="text-[10px] uppercase tracking-wider font-semibold"
                          style={{ color: colorCultivo(c.nombre) }}
                        >
                          {c.nombre}
                        </span>
                        <p className="display-number text-xl text-foreground mt-1">
                          {c.ha.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                          <span className="text-xs text-muted-foreground font-medium ml-1">ha</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}% del total</p>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </>
          )}
        </motion.div>

        {/* Atajos */}
        <motion.div
          {...item(0.25)}
          className="col-span-12 md:col-span-5 row-span-2 rounded-2xl bg-foreground text-background p-6 flex flex-col"
        >
          <h3 className="font-semibold">Atajos rápidos</h3>
          <p className="text-xs text-background/65 mt-1">Usá <kbd className="bg-white/15 px-1 rounded text-[10px]">⌘K</kbd> para ir a cualquier lado</p>

          <ul className="mt-4 space-y-2 flex-1">
            {[
              { to: '/establecimientos', label: 'Crear establecimiento', icon: Tractor },
              { to: '/lotes', label: 'Cargar un lote nuevo', icon: Sprout },
              { to: '/campanias', label: 'Abrir una campaña', icon: CalendarRange },
              { to: '/carga', label: 'Registrar labor o insumo', icon: TrendingUp },
            ].map((a) => (
              <li key={a.to}>
                <Link
                  to={a.to}
                  className={cn(
                    'group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg',
                    'bg-white/5 hover:bg-white/10 transition',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <a.icon className="h-4 w-4 text-background/75" />
                    <span className="text-sm">{a.label}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-background/40 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
