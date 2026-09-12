import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../services/tokenizadasService';
import { usd, usdCompacto, porcentaje, toneladas, diasRestantes, abreviarTx } from '../utils/format';
import { EstadoCampanaBadge } from '../components/campana/EstadoCampanaBadge';
import { BadgeModo } from '../components/campana/BadgeModo';
import { useWalletStore } from '../stores/walletStore';
import { Link } from 'react-router-dom';

export function PortfolioPage() {
  const conectada = useWalletStore((s) => s.conectada);
  const { data, isLoading } = useQuery({
    queryKey: ['tk', 'portfolio'],
    queryFn: () => tokenizadasApi.portfolio(),
    enabled: !!conectada,
  });

  if (!conectada) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <div className="text-5xl mb-4 opacity-70">◈</div>
        <h1 className="text-white text-2xl font-semibold mb-2">Conectá tu wallet</h1>
        <p className="text-white/40 text-sm">Necesitás una wallet conectada para ver tu portfolio.</p>
      </div>
    );
  }

  if (isLoading) return <div className="text-white/40 text-sm">Cargando portfolio...</div>;

  const r = data?.resumen;
  const tenencias = data?.tenencias ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-white text-2xl font-semibold">Portfolio</h1>
        <p className="text-white/40 text-xs mt-1">Tus tenencias de tokens agropecuarios</p>
      </div>

      {/* Métricas grandes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricaGrande
          label="Invertido"
          valor={r ? usdCompacto(r.invertidoUsd) : '$0'}
          sub={r?.cantidadTenencias ? `${r.cantidadTenencias} tenencias` : ''}
        />
        <MetricaGrande
          label="Valor actual"
          valor={r ? usdCompacto(r.valorActualUsd) : '$0'}
          sub="Estimado, en USD"
        />
        <MetricaGrande
          label="Retorno no realizado"
          valor={r ? usdCompacto(r.retornoNoRealizado) : '$0'}
          cambio={r?.retornoPct}
          destacado
        />
        <MetricaGrande
          label="Toneladas totales"
          valor={toneladas(tenencias.reduce((s, t) => s + t.tokens, 0), 0)}
          sub="Tokens · 1 token = 1 tn"
        />
      </div>

      {/* Tabla de tenencias */}
      <div className="bg-[#0F1216] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-baseline justify-between">
          <h2 className="text-white font-semibold text-sm">Tenencias</h2>
          <span className="text-white/40 text-xs">{tenencias.length} posiciones</span>
        </div>
        {tenencias.length === 0 ? (
          <div className="text-center py-16 text-white/40 text-sm">
            <div>Todavía no invertiste.</div>
            <Link to="/tk/invertir" className="text-emerald-400 hover:underline text-xs mt-2 inline-block">
              Explorar marketplace →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/30 text-white/40 text-[10px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3">Campaña</th>
                  <th className="text-left px-3 py-3">Modo</th>
                  <th className="text-right px-3 py-3">Tokens</th>
                  <th className="text-right px-3 py-3">Precio compra</th>
                  <th className="text-right px-3 py-3">Valor actual</th>
                  <th className="text-right px-3 py-3">Variación</th>
                  <th className="text-left px-3 py-3">Estado</th>
                  <th className="text-left px-3 py-3">Cosecha</th>
                  <th className="text-left px-5 py-3">Tx compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenencias.map((t) => {
                  const valorActual = t.tokens * t.tokenizacion.precioTokenUsd;
                  const variacion = valorActual - t.montoTotalUsd;
                  const variacionPct = t.montoTotalUsd > 0 ? (variacion / t.montoTotalUsd) * 100 : 0;
                  return (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          to={`/tk/invertir/${t.tokenizacionId}`}
                          className="text-white hover:text-emerald-400 font-medium"
                        >
                          {t.tokenizacion.campania.establecimiento?.nombre ?? t.tokenizacion.campania.nombre}
                        </Link>
                        <div className="text-white/40 text-[11px] mt-0.5">
                          {t.tokenizacion.campania.cultivo?.nombre} ·{' '}
                          {t.tokenizacion.campania.establecimiento?.partido}, {t.tokenizacion.campania.establecimiento?.provincia}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <BadgeModo modo={t.tokenizacion.modo} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-white/90">
                        {toneladas(t.tokens, 1)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-white/70">{usd(t.precioCompraUsd, 2)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-white font-medium">
                        {usd(valorActual, 0)}
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums font-medium ${variacion >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {porcentaje(variacionPct, 2)}
                      </td>
                      <td className="px-3 py-3">
                        {t.tokenizacion.campania.estadoToken && (
                          <EstadoCampanaBadge estado={t.tokenizacion.campania.estadoToken} />
                        )}
                      </td>
                      <td className="px-3 py-3 text-white/60 text-xs">
                        {t.tokenizacion.campania.fechaCosechaEstimada
                          ? diasRestantes(t.tokenizacion.campania.fechaCosechaEstimada)
                          : '—'}
                      </td>
                      <td className="px-5 py-3">
                        {t.txSignatureCompra ? (
                          <span className="font-mono text-[11px] text-white/40" title={t.txSignatureCompra}>
                            {abreviarTx(t.txSignatureCompra)}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
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
    </div>
  );
}

function MetricaGrande({
  label,
  valor,
  sub,
  cambio,
  destacado,
}: {
  label: string;
  valor: string;
  sub?: string;
  cambio?: number;
  destacado?: boolean;
}) {
  return (
    <div className={`bg-[#0F1216] border rounded-xl p-4 ${destacado ? 'border-emerald-500/20 shadow-lg shadow-emerald-900/10' : 'border-white/5'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">{label}</div>
      <div className="text-2xl font-semibold text-white tabular-nums">{valor}</div>
      {cambio !== undefined && (
        <div className={`text-xs tabular-nums mt-1 ${cambio >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {porcentaje(cambio, 2)}
        </div>
      )}
      {sub && !cambio && <div className="text-white/40 text-[11px] mt-1">{sub}</div>}
    </div>
  );
}
