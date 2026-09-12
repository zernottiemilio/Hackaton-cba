import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Wallet } from 'lucide-react';
import { tokenizadasService } from '@/services/tokenizadasService';

const FMT_USD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FMT_FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });

const ESTADO_STYLE: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  en_revision: 'bg-amber-500/10 text-amber-700',
  rechazada: 'bg-destructive/10 text-destructive',
  abierta: 'bg-primary/10 text-primary',
  fondeada: 'bg-blue-500/10 text-blue-600',
  en_curso: 'bg-amber-500/10 text-amber-700',
  en_cosecha: 'bg-amber-500/10 text-amber-700',
  liquidada: 'bg-emerald-500/10 text-emerald-700',
  cancelada: 'bg-destructive/10 text-destructive',
};

export function EmisionesListPage() {
  const { data: campanas, isLoading, error } = useQuery({
    queryKey: ['mis-campanas'],
    queryFn: () => tokenizadasService.misCampanas(),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mis emisiones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Campañas que tokenizaste, con el fondeo actual y el estado.
          </p>
        </div>
        <Link
          to="/emisiones/nueva"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nueva emisión
        </Link>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No pudimos cargar tus emisiones.
        </div>
      )}

      {campanas && campanas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-base font-medium">Todavía no tokenizaste ninguna campaña</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Publicá una parte de tu producción para financiar la siembra.
          </p>
          <Link
            to="/emisiones/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Empezar mi primera emisión
          </Link>
        </div>
      )}

      {campanas && campanas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campanas.map((c) => {
            const cierre = new Date(c.fondeoHasta);
            const precio = Number(c.precioTokenUsd);
            const cultivo = c.campania.cultivo?.nombre ?? '—';
            const modo = c.modo === 'porcentual'
              ? `${c.porcentaje ?? 0}%`
              : `${c.toneladasFijas?.toLocaleString('es-AR') ?? 0} tn`;

            return (
              <div key={c.id} className="rounded-2xl bg-surface border border-border p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {c.campania.nombre}
                    </p>
                    <h2 className="text-lg font-semibold truncate">
                      {c.campania.establecimiento?.nombre ?? 'Campo'}
                    </h2>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      ESTADO_STYLE[c.campania.estadoToken] ?? 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {c.campania.estadoToken.replace('_', ' ')}
                  </span>
                </div>

                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Cultivo</dt>
                    <dd className="font-medium capitalize">{cultivo}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ofrecido</dt>
                    <dd className="font-medium">{modo}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Precio</dt>
                    <dd className="font-semibold">{FMT_USD.format(precio)}/tn</dd>
                  </div>
                </dl>

                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Fondeo hasta {FMT_FECHA.format(cierre)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
