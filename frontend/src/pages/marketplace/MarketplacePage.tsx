import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarClock, Loader2, MapPin, Package, ShieldCheck, Wheat } from 'lucide-react';
import { tokenizadasService, type FiltrosMarketplace } from '@/services/tokenizadasService';

const FMT_USD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FMT_PCT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const FMT_FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' });

export function MarketplacePage() {
  const [filtros, setFiltros] = useState<FiltrosMarketplace>({ orden: 'cierra_pronto' });

  const { data: campanas, isLoading, error } = useQuery({
    queryKey: ['marketplace', filtros],
    queryFn: () => tokenizadasService.listarMarketplace(filtros),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Marketplace de campañas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Producción a futuro tokenizada. Comprá directamente al productor y liquidá en cosecha.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Ordenar por</label>
          <select
            value={filtros.orden}
            onChange={(e) => setFiltros((f) => ({ ...f, orden: e.target.value as FiltrosMarketplace['orden'] }))}
            className="h-9 px-3 rounded-lg border border-border bg-surface text-sm"
          >
            <option value="cierra_pronto">Cierra pronto</option>
            <option value="mayor_descuento">Mayor descuento</option>
            <option value="menor_riesgo">Menor riesgo</option>
            <option value="recientes">Recientes</option>
          </select>
        </div>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No pudimos cargar el marketplace. Intentá refrescar en un rato.
        </div>
      )}

      {campanas && campanas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-base font-medium">No hay campañas abiertas en este momento</p>
          <p className="text-sm text-muted-foreground mt-1">
            Se publican campañas todo el año. Volvé más tarde o suscribite a notificaciones.
          </p>
        </div>
      )}

      {campanas && campanas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campanas.map((c, i) => {
            const cultivo = c.campania.cultivo?.nombre ?? 'sin cultivo';
            const ubic = [c.campania.establecimiento?.localidad, c.campania.establecimiento?.provincia]
              .filter(Boolean)
              .join(', ');
            const precio = Number(c.precioTokenUsd);
            const descuento = Number(c.descuentoPct);
            const fechaCierre = new Date(c.fondeoHasta);
            const conGarantias = c.tieneSeguroGranizo || c.tieneSeguroParametrico || c.tieneAvalSgr;

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Link
                  to={`/marketplace/${c.id}`}
                  className="group block h-full rounded-2xl bg-surface border border-border hover:border-primary/40 hover:shadow-lift transition p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {c.campania.nombre}
                      </p>
                      <h2 className="text-lg font-semibold truncate">
                        {c.campania.establecimiento?.nombre ?? 'Campo'}
                      </h2>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.productor.nombre}</p>
                    </div>
                    {conGarantias && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Garantía
                      </span>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wheat className="h-3 w-3" /> Cultivo
                      </dt>
                      <dd className="font-medium capitalize">{cultivo}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Ubicación
                      </dt>
                      <dd className="font-medium truncate">{ubic || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Precio token</dt>
                      <dd className="font-semibold">{FMT_USD.format(precio)}/tn</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Descuento</dt>
                      <dd className="font-semibold text-primary">{FMT_PCT.format(descuento)}%</dd>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Cierra {FMT_FECHA.format(fechaCierre)}
                    </div>
                  </dl>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
