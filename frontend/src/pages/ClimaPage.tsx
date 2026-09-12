import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Wind, Droplets, MapPin, AlertCircle, Sunrise, Sunset, Thermometer,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { WeatherIcon } from '@/components/clima/WeatherIcon';
import { establecimientosService } from '@/services/establecimientosService';
import { climaService } from '@/services/climaService';
import { cn } from '@/lib/utils';
import type { Establecimiento } from '@/types/agro';

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function ClimaPage() {
  const { data: establecimientos } = useQuery({
    queryKey: ['establecimientos'],
    queryFn: () => establecimientosService.listar({ limit: 100 }),
  });

  const conCoordenadas = useMemo(
    () => (establecimientos?.items ?? []).filter((e) => e.latitud && e.longitud),
    [establecimientos],
  );

  const [estabId, setEstabId] = useState<string>('');

  useEffect(() => {
    if (!estabId && conCoordenadas.length > 0) setEstabId(conCoordenadas[0].id);
  }, [estabId, conCoordenadas]);

  const estabActivo = conCoordenadas.find((e) => e.id === estabId);
  const lat = estabActivo ? Number(estabActivo.latitud) : null;
  const lon = estabActivo ? Number(estabActivo.longitud) : null;

  const { data: actual, isLoading: loadingActual, error: errorActual } = useQuery({
    queryKey: ['clima-actual', lat, lon],
    queryFn: () => climaService.actual(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 10 * 60 * 1000,
  });

  const { data: pronostico, isLoading: loadingPronostico } = useQuery({
    queryKey: ['clima-pronostico', lat, lon],
    queryFn: () => climaService.pronostico(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 30 * 60 * 1000,
  });

  // ============================================================
  // Sin establecimientos con coordenadas → onboarding
  // ============================================================
  if (!establecimientos) return <div className="h-64 shimmer rounded-xl" />;

  if (conCoordenadas.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <p className="text-sm text-muted-foreground">Open-Meteo · gratis · datos del SMN+ECMWF</p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Clima</h1>
        </header>

        <EmptyState
          icon={MapPin}
          title="Necesitamos las coordenadas del campo"
          description="Para mostrarte el clima, agregale latitud y longitud a alguno de tus establecimientos. Te alcanza con tocar 'Usar ubicación actual' una vez."
          action={
            establecimientos.items.length > 0
              ? { label: 'Ir a Establecimientos', onClick: () => (window.location.href = '/establecimientos') }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Open-Meteo · datos del SMN + ECMWF</p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Clima</h1>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={estabId}
            onChange={(e) => setEstabId(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface text-sm flex-1 sm:flex-none"
          >
            {conCoordenadas.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
          {estabActivo && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {Number(estabActivo.latitud).toFixed(4)}, {Number(estabActivo.longitud).toFixed(4)}
            </span>
          )}
        </div>
      </header>

      {/* Hero — clima actual */}
      {loadingActual ? (
        <div className="h-48 shimmer rounded-2xl" />
      ) : errorActual ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-foreground">No se pudo cargar el clima — probá de nuevo en un rato.</p>
        </div>
      ) : actual ? (
        <HeroClima actual={actual} establecimiento={estabActivo!} />
      ) : null}

      {/* Pronóstico 7 días */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-semibold text-foreground">Próximos 7 días</h2>
          <p className="text-xs text-muted-foreground">Pronóstico · actualizado cada hora</p>
        </div>

        {loadingPronostico ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-44 shimmer rounded-xl" />
            ))}
          </div>
        ) : pronostico ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {pronostico.dias.map((dia, i) => (
              <DiaCard key={dia.fecha} dia={dia} delay={i * 0.04} esHoy={i === 0} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function HeroClima({ actual, establecimiento }: { actual: NonNullable<ReturnType<typeof climaService.actual> extends Promise<infer T> ? T : never>; establecimiento: Establecimiento }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden shadow-glass relative text-white"
      style={{
        background: actual.esDeNoche
          ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #047C00 130%)'
          : 'linear-gradient(135deg, #047C00 0%, #06820B 50%, #013E00 100%)',
      }}
    >
      <div className="absolute -right-8 -top-4 opacity-15">
        <WeatherIcon icono={actual.info.icono} esDeNoche={actual.esDeNoche} size={220} />
      </div>

      <div className="relative p-6 lg:p-8">
        <p className="text-[11px] uppercase tracking-widest text-white/70 font-medium">
          {establecimiento.nombre}{establecimiento.ubicacion ? ` · ${establecimiento.ubicacion}` : ''}
        </p>

        <div className="flex items-end gap-3 mt-3">
          <span className="display-number text-6xl lg:text-7xl leading-none">
            {Math.round(actual.temperatura)}°
          </span>
          <div className="pb-2">
            <p className="font-semibold capitalize">{actual.info.descripcion}</p>
            <p className="text-sm text-white/80">Sensación {Math.round(actual.sensacion)}°</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
          <Stat icon={Droplets} label="Humedad" value={`${Math.round(actual.humedad)}%`} />
          <Stat icon={Wind} label="Viento" value={`${Math.round(actual.vientoKmh)} km/h`} />
          <Stat icon={Thermometer} label="Lluvia última hora" value={`${actual.lluvia.toFixed(1)} mm`} />
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wind; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/70 font-semibold">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-sm font-bold mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function DiaCard({ dia, delay, esHoy }: { dia: NonNullable<ReturnType<typeof climaService.pronostico> extends Promise<infer T> ? T : never>['dias'][number]; delay: number; esHoy: boolean }) {
  const fecha = new Date(`${dia.fecha}T00:00:00`);
  const diaSemana = DIAS_SEMANA_CORTO[fecha.getDay()];
  const diaNumero = fecha.getDate();
  const lluvioso = dia.lluvia > 0.5 || dia.probLluvia > 40;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'rounded-xl border p-4 flex flex-col items-center text-center transition',
        esHoy ? 'border-primary bg-primary/5 shadow-glow' : 'border-border bg-surface',
      )}
    >
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        {esHoy ? 'Hoy' : diaSemana}
      </p>
      <p className="text-xs text-muted-foreground">{diaNumero}</p>

      <WeatherIcon
        icono={dia.info.icono}
        className={cn('mt-2', lluvioso ? 'text-info' : 'text-primary')}
        size={36}
      />

      <div className="mt-3 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-lg font-bold text-foreground">{Math.round(dia.tMax)}°</span>
        <span className="text-sm text-muted-foreground">{Math.round(dia.tMin)}°</span>
      </div>

      <p className="text-[10px] text-muted-foreground capitalize mt-1 leading-tight">
        {dia.info.descripcion}
      </p>

      <div className="mt-3 w-full pt-3 border-t border-border/60 grid grid-cols-2 gap-1 text-[10px]">
        <div className="flex flex-col items-center">
          <span className="text-muted-foreground">Lluvia</span>
          <span className="font-bold text-info tabular-nums">{dia.lluvia.toFixed(1)} mm</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-muted-foreground">Prob.</span>
          <span className="font-bold text-foreground tabular-nums">{Math.round(dia.probLluvia)}%</span>
        </div>
      </div>
    </motion.div>
  );
}

void Sunrise; void Sunset; void Link;
