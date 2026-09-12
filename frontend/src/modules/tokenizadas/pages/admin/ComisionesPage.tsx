import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  tokenizadasApi,
  type FiltrosComisiones,
  type TipoComision,
} from '../../services/tokenizadasService';
import { useContextoActivo, useWalletStore } from '../../stores/walletStore';
import { explorerTxUrl } from '../../utils/explorer';
import { usd, usdCompacto, fecha, abreviarTx, porcentaje } from '../../utils/format';

/**
 * Auditoría de comisiones de plataforma (1,5% sobre cada operación).
 *
 * Se cobran automáticamente en dos momentos del flujo:
 *  - Cuando el inversor confirma la compra de tokens (`compra_inversor`).
 *  - Cuando el productor libera fondos del vault (`cobro_productor`).
 *
 * El asiento es inmutable y guarda la tasa vigente al momento de la
 * operación, para que la auditoría no se rompa si el fee cambia.
 */
export function ComisionesPage() {
  const contexto = useContextoActivo();
  const red = useWalletStore((s) => s.conectada?.network ?? 'mock');
  const [tipo, setTipo] = useState<TipoComision | undefined>(undefined);
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');

  const filtros = useMemo<FiltrosComisiones>(() => {
    const f: FiltrosComisiones = {};
    if (tipo) f.tipo = tipo;
    if (desde) f.desde = desde;
    if (hasta) f.hasta = hasta;
    return f;
  }, [tipo, desde, hasta]);

  const { data, isLoading } = useQuery({
    queryKey: ['tk', 'admin', 'comisiones', filtros],
    queryFn: () => tokenizadasApi.listarComisiones(filtros),
    enabled: contexto === 'admin_plataforma',
    refetchInterval: 15000,
  });

  if (contexto !== 'admin_plataforma') {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <h1 style={{ color: 'var(--hv-text)', fontSize: 22, fontWeight: 600 }}>Acceso restringido</h1>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6 }}>
          Necesitás el rol Admin para ver la auditoría de comisiones.
        </p>
      </div>
    );
  }

  const resumen = data?.resumen;
  const items = data?.items ?? [];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      <header className="space-y-1">
        <h1 style={{ color: 'var(--hv-text)', fontSize: 24, fontWeight: 700 }}>Comisiones de plataforma</h1>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13 }}>
          Auditoría de la retención del{' '}
          <strong>{porcentaje(resumen?.tasaVigentePct ?? 1.5, 2)}</strong>{' '}
          que se aplica a cada compra de inversor y a cada cobro de productor. Los asientos son inmutables y
          reflejan la tasa vigente al momento de la operación.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          titulo="Total retenido"
          valor={resumen ? usd(resumen.total.montoComisionUsd, 2) : '—'}
          detalle={resumen ? `${resumen.total.operaciones} operaciones` : ''}
          destacado
        />
        <KpiCard
          titulo="Volumen bruto"
          valor={resumen ? usdCompacto(resumen.total.montoBrutoUsd) : '—'}
          detalle="Suma de todas las operaciones"
        />
        <KpiCard
          titulo="Comisiones · compra inversor"
          valor={resumen ? usd(resumen.compraInversor.montoComisionUsd, 2) : '—'}
          detalle={resumen ? `${resumen.compraInversor.operaciones} compras` : ''}
        />
        <KpiCard
          titulo="Comisiones · cobro productor"
          valor={resumen ? usd(resumen.cobroProductor.montoComisionUsd, 2) : '—'}
          detalle={resumen ? `${resumen.cobroProductor.operaciones} liberaciones` : ''}
        />
      </section>

      {/* Filtros */}
      <section
        className="flex flex-wrap gap-3 items-end p-4 rounded-lg"
        style={{ background: 'var(--hv-surface)', border: '1px solid var(--hv-border)' }}
      >
        <div className="flex flex-col gap-1">
          <label style={{ color: 'var(--hv-text-muted)', fontSize: 12 }}>Tipo</label>
          <select
            value={tipo ?? ''}
            onChange={(e) => setTipo((e.target.value || undefined) as TipoComision | undefined)}
            className="rounded px-2 py-1 text-sm"
            style={{ background: 'var(--hv-bg)', border: '1px solid var(--hv-border)', color: 'var(--hv-text)' }}
          >
            <option value="">Todos</option>
            <option value="compra_inversor">Compra inversor</option>
            <option value="cobro_productor">Cobro productor</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ color: 'var(--hv-text-muted)', fontSize: 12 }}>Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded px-2 py-1 text-sm"
            style={{ background: 'var(--hv-bg)', border: '1px solid var(--hv-border)', color: 'var(--hv-text)' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ color: 'var(--hv-text-muted)', fontSize: 12 }}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded px-2 py-1 text-sm"
            style={{ background: 'var(--hv-bg)', border: '1px solid var(--hv-border)', color: 'var(--hv-text)' }}
          />
        </div>
        {(tipo || desde || hasta) && (
          <button
            onClick={() => {
              setTipo(undefined);
              setDesde('');
              setHasta('');
            }}
            className="text-sm px-3 py-1 rounded"
            style={{ color: 'var(--hv-text-muted)', border: '1px solid var(--hv-border)' }}
          >
            Limpiar
          </button>
        )}
      </section>

      {/* Tabla */}
      <section
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--hv-surface)', border: '1px solid var(--hv-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--hv-bg)', color: 'var(--hv-text-muted)', textAlign: 'left' }}>
                <th className="p-3 font-medium">Fecha</th>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Campaña</th>
                <th className="p-3 font-medium">Usuario</th>
                <th className="p-3 font-medium text-right">Bruto</th>
                <th className="p-3 font-medium text-right">%</th>
                <th className="p-3 font-medium text-right">Comisión</th>
                <th className="p-3 font-medium text-right">Neto</th>
                <th className="p-3 font-medium">Tx operación</th>
                <th className="p-3 font-medium">Tx comisión</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="p-8 text-center" style={{ color: 'var(--hv-text-muted)' }}>
                    Cargando…
                  </td>
                </tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center" style={{ color: 'var(--hv-text-muted)' }}>
                    No hay comisiones para estos filtros.
                  </td>
                </tr>
              )}
              {items.map((c) => {
                const link = c.txReferencia ? explorerTxUrl(c.txReferencia, red) : null;
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--hv-border)' }}>
                    <td className="p-3" style={{ color: 'var(--hv-text-muted)' }}>{fecha(c.createdAt)}</td>
                    <td className="p-3">
                      <TipoBadge tipo={c.tipo} />
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/campanas/${c.tokenizacionId}`}
                        style={{ color: 'var(--hv-text)', textDecoration: 'none' }}
                      >
                        <div style={{ fontWeight: 500 }}>{c.tokenizacion.campania.nombre}</div>
                        <div style={{ color: 'var(--hv-text-muted)', fontSize: 12 }}>
                          {c.tokenizacion.campania.cultivo?.nombre}
                          {c.tokenizacion.campania.establecimiento?.provincia
                            ? ` · ${c.tokenizacion.campania.establecimiento.provincia}`
                            : ''}
                        </div>
                      </Link>
                    </td>
                    <td className="p-3">
                      <div style={{ fontWeight: 500 }}>{c.usuario.nombre}</div>
                      <div style={{ color: 'var(--hv-text-muted)', fontSize: 12 }}>{c.usuario.email}</div>
                    </td>
                    <td className="p-3 text-right" style={{ color: 'var(--hv-text-muted)' }}>
                      {usd(Number(c.montoBrutoUsd), 2)}
                    </td>
                    <td className="p-3 text-right" style={{ color: 'var(--hv-text-muted)' }}>
                      {porcentaje(Number(c.porcentaje), 2)}
                    </td>
                    <td className="p-3 text-right" style={{ color: 'var(--hv-primary)', fontWeight: 600 }}>
                      {usd(Number(c.montoComisionUsd), 2)}
                    </td>
                    <td className="p-3 text-right">{usd(Number(c.montoNetoUsd), 2)}</td>
                    <td className="p-3">
                      {c.txReferencia ? (
                        link ? (
                          <a href={link} target="_blank" rel="noreferrer" style={{ color: 'var(--hv-primary)' }}>
                            {abreviarTx(c.txReferencia)}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--hv-text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                            {abreviarTx(c.txReferencia)}
                          </span>
                        )
                      ) : (
                        <span style={{ color: 'var(--hv-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {c.txComision ? (
                        (() => {
                          const lc = explorerTxUrl(c.txComision, red);
                          return lc ? (
                            <a href={lc} target="_blank" rel="noreferrer" style={{ color: 'var(--hv-primary)' }}>
                              {abreviarTx(c.txComision)}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--hv-text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                              {abreviarTx(c.txComision)}
                            </span>
                          );
                        })()
                      ) : (
                        <span title="Asiento registrado, transferencia pendiente" style={{ color: 'var(--hv-amber-text)', fontSize: 12 }}>
                          pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  detalle,
  destacado,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  destacado?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: destacado ? 'var(--hv-primary-soft, rgba(4,124,0,0.08))' : 'var(--hv-surface)',
        border: '1px solid var(--hv-border)',
      }}
    >
      <div style={{ color: 'var(--hv-text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {titulo}
      </div>
      <div
        style={{
          color: destacado ? 'var(--hv-primary)' : 'var(--hv-text)',
          fontSize: 24,
          fontWeight: 700,
          marginTop: 4,
        }}
      >
        {valor}
      </div>
      {detalle && (
        <div style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 4 }}>{detalle}</div>
      )}
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: TipoComision }) {
  const label = tipo === 'compra_inversor' ? 'Compra inversor' : 'Cobro productor';
  const bg = tipo === 'compra_inversor' ? 'rgba(15, 119, 2, 0.12)' : 'rgba(4, 124, 0, 0.12)';
  const color = tipo === 'compra_inversor' ? '#0F7702' : '#047C00';
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}
