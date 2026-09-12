import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { tokenizadasService } from '@/services/tokenizadasService';
import { useAuthStore } from '@/stores/authStore';
import { extraerMensajeError } from '@/lib/apiClient';

const FMT_USD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FMT_PCT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });

export function PortfolioInversorPage() {
  const walletAddress = useAuthStore((s) => s.usuario?.walletAddress);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => tokenizadasService.portfolio(),
  });

  const reclamarMutation = useMutation({
    mutationFn: (tenenciaId: string) =>
      tokenizadasService.reclamar({ tenenciaId, inversorWallet: walletAddress! }),
    onSuccess: (res: { usdcRecibido?: number } & Record<string, unknown>) => {
      toast.success(
        res.usdcRecibido
          ? `Cobraste ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(res.usdcRecibido as number)}`
          : 'Reclamación confirmada',
      );
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        No pudimos cargar tu portfolio.
      </div>
    );
  }

  const { tenencias, resumen } = data;
  const retornoPositivo = resumen.retornoNoRealizado >= 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Mi portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tenencias activas y valor estimado al precio de mercado del día.
        </p>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Invertido" value={FMT_USD.format(resumen.invertidoUsd)} />
        <MetricCard label="Valor actual" value={FMT_USD.format(resumen.valorActualUsd)} />
        <MetricCard
          label="Retorno no realizado"
          value={FMT_USD.format(resumen.retornoNoRealizado)}
          tone={retornoPositivo ? 'success' : 'danger'}
          icon={retornoPositivo ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />
        <MetricCard
          label="Rendimiento"
          value={`${FMT_PCT.format(resumen.retornoPct)}%`}
          tone={retornoPositivo ? 'success' : 'danger'}
        />
      </div>

      {/* Tenencias */}
      {tenencias.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-base font-medium">Todavía no tenés tenencias</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Comprá tu primer token en el marketplace para arrancar.
          </p>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Ir al marketplace
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Campaña</th>
                <th className="text-left p-3">Productor</th>
                <th className="text-right p-3">Tokens</th>
                <th className="text-right p-3">Invertido</th>
                <th className="text-right p-3">Valor actual</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenencias.map((t) => {
                const tokens = Number(t.tokens);
                const invertido = Number(t.montoTotalUsd);
                const precioActual = Number(t.tokenizacion.precioTokenUsd);
                const valorActual = tokens * precioActual;
                const reclamable =
                  t.estado === 'activa' &&
                  t.tokenizacion.campania.estadoToken === 'liquidada' &&
                  !!walletAddress;
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-3">
                      <Link to={`/marketplace/${t.tokenizacion.id}`} className="hover:text-primary">
                        <span className="font-medium">{t.tokenizacion.campania.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t.tokenizacion.campania.establecimiento?.nombre}
                        </span>
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{t.tokenizacion.productor.nombre}</td>
                    <td className="p-3 text-right font-mono">{tokens.toLocaleString('es-AR')}</td>
                    <td className="p-3 text-right">{FMT_USD.format(invertido)}</td>
                    <td className="p-3 text-right font-medium">{FMT_USD.format(valorActual)}</td>
                    <td className="p-3">
                      <EstadoBadge estado={t.tokenizacion.campania.estadoToken} />
                    </td>
                    <td className="p-3 text-right">
                      {reclamable ? (
                        <button
                          onClick={() => reclamarMutation.mutate(t.id)}
                          disabled={reclamarMutation.isPending}
                          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                          {reclamarMutation.isPending && reclamarMutation.variables === t.id ? (
                            <Loader2 className="h-3 w-3 inline animate-spin" />
                          ) : (
                            'Cobrar'
                          )}
                        </button>
                      ) : t.estado === 'reclamada' ? (
                        <span className="text-xs text-muted-foreground">Cobrada</span>
                      ) : t.estado === 'reembolsada' ? (
                        <span className="text-xs text-muted-foreground">Reembolsada</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === 'success' ? 'text-primary' : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold mt-1 flex items-center gap-1.5 ${toneClass}`}>
        {icon}
        {value}
      </p>
    </div>
  );
}

const ESTADO_STYLE: Record<string, string> = {
  abierta: 'bg-primary/10 text-primary',
  fondeada: 'bg-blue-500/10 text-blue-600',
  en_curso: 'bg-amber-500/10 text-amber-700',
  en_cosecha: 'bg-amber-500/10 text-amber-700',
  liquidada: 'bg-emerald-500/10 text-emerald-700',
  cancelada: 'bg-destructive/10 text-destructive',
  en_revision: 'bg-muted text-muted-foreground',
  rechazada: 'bg-destructive/10 text-destructive',
  borrador: 'bg-muted text-muted-foreground',
};

function EstadoBadge({ estado }: { estado: string }) {
  const cls = ESTADO_STYLE[estado] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {estado.replace('_', ' ')}
    </span>
  );
}
