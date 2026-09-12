import { useWalletStore, type TxEntry } from '../../stores/walletStore';
import { explorerTxUrl } from '../../utils/explorer';
import { usd, abreviarTx } from '../../utils/format';

const ETIQUETA: Record<TxEntry['tipo'], string> = {
  publicar: 'Publicación',
  reservar: 'Reserva',
  comprar: 'Compra',
  reclamar: 'Cobro inversor',
  liberar: 'Cobro siembra',
  liquidar: 'Liquidación',
  fee: 'Fee',
};

const COLOR: Record<TxEntry['tipo'], string> = {
  publicar: 'var(--hv-text-2)',
  reservar: 'var(--hv-text-2)',
  comprar: 'var(--hv-green-text)',
  reclamar: 'var(--hv-green-text)',
  liberar: 'var(--hv-green-text)',
  liquidar: 'var(--hv-text)',
  fee: 'var(--hv-amber-text)',
};

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Actividad de la wallet: cada transacción que este usuario disparó desde la
 * app, con su signature y link al explorer. Es donde el jurado mira cuando
 * pregunta "¿y dónde quedó registrado?". Vive en el store (persistido en el
 * navegador); no reemplaza la auditoría del admin.
 */
export function ActividadWallet({ max = 8 }: { max?: number }) {
  const historial = useWalletStore((s) => s.historialTx);
  const red = useWalletStore((s) => s.conectada?.network ?? 'mock');
  const items = historial.slice(0, max);

  return (
    <div className="p-4" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <div className="hv-label-sm" style={{ fontSize: 10 }}>Actividad on-chain</div>
        {historial.length > 0 && (
          <span className="hv-label-sm" style={{ fontSize: 9 }}>
            {historial.length} {historial.length === 1 ? 'movimiento' : 'movimientos'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ color: 'var(--hv-text-muted)', fontSize: 11, lineHeight: 1.5 }}>
          Todavía no hiciste ninguna transacción desde esta wallet. Cada compra, cobro o fee aparece acá con
          su link al explorer.
        </div>
      ) : (
        <ul className="space-y-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {items.map((tx) => {
            const link = explorerTxUrl(tx.signature, red);
            return (
              <li key={tx.signature} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ color: COLOR[tx.tipo], fontSize: 11, fontWeight: 600 }}>{ETIQUETA[tx.tipo]}</span>
                    <span className="hv-label-sm" style={{ fontSize: 9 }}>{hora(tx.timestamp)}</span>
                  </div>
                  <div
                    style={{
                      color: 'var(--hv-text-muted)',
                      fontSize: 10.5,
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 170,
                    }}
                    title={tx.descripcion}
                  >
                    {tx.descripcion}
                  </div>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="hv-mono"
                      style={{ color: 'var(--hv-green-text)', fontSize: 10, textDecoration: 'none' }}
                      title={tx.signature}
                    >
                      {abreviarTx(tx.signature)} ↗
                    </a>
                  ) : (
                    <span className="hv-mono" style={{ color: 'var(--hv-text-muted)', fontSize: 10 }} title={tx.signature}>
                      {abreviarTx(tx.signature)}
                    </span>
                  )}
                </div>
                {tx.usdcMovido !== undefined && tx.usdcMovido !== 0 && (
                  <span
                    className="hv-mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: tx.usdcMovido > 0 ? 'var(--hv-green-text)' : 'var(--hv-text)',
                    }}
                  >
                    {tx.usdcMovido > 0 ? '+' : '−'}
                    {usd(Math.abs(tx.usdcMovido), 2)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
