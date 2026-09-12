import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Tokenizacion } from '../../types/tokenizadas';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { useWalletStore } from '../../stores/walletStore';
import { FirmaTxModal } from '../wallet/FirmaTxModal';
import { explorerTxUrl } from '../../utils/explorer';
import { usd, toneladas } from '../../utils/format';

interface Props {
  t: Tokenizacion;
  /** Versión chica para filas de tabla. */
  compacto?: boolean;
}

/**
 * "Cobrar siembra": dispara release_funds. El backend firma con la wallet
 * custodial del productor y el vault se vacía hacia su cuenta.
 *
 * Reglas (espejo de las validaciones on-chain):
 *  - estado `abierta`
 *  - tokensVendidos >= toneladasMinimas (min_tons)
 * Cuando ya está `fondeada`, muestra el estado en lugar del botón.
 */
export function BotonCobrarSiembra({ t, compacto = false }: Props) {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const conectada = useWalletStore((s) => s.conectada);
  const registrarTx = useWalletStore((s) => s.registrarTx);

  const estado = t.campania.estadoToken;
  const vendidos = Number(t.tokensVendidos);
  const minimas = Number(t.toneladasMinimas ?? 1);
  const recaudado = Number(t.montoRecaudadoUsd);

  if (estado === 'fondeada' || estado === 'en_curso' || estado === 'en_cosecha' || estado === 'liquidada') {
    const link = t.txSignatureLiberacion && conectada ? explorerTxUrl(t.txSignatureLiberacion, conectada.network) : null;
    return (
      <span className="hv-chip" style={{ fontSize: compacto ? 11 : 12, color: 'var(--hv-green-text)', borderColor: 'rgba(43,224,106,0.28)', background: 'var(--hv-green-soft)' }}>
        <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
        Cobrada
        {link && (
          <a href={link} target="_blank" rel="noreferrer" style={{ color: 'inherit', marginLeft: 6, textDecoration: 'none' }}>
            ↗
          </a>
        )}
      </span>
    );
  }

  if (estado !== 'abierta') return null;

  const alcanzaMinimo = vendidos >= minimas;
  const puede = !!conectada && alcanzaMinimo;
  const motivo = !conectada
    ? 'Conectá tu wallet para cobrar'
    : !alcanzaMinimo
    ? `Faltan ${toneladas(minimas - vendidos, 0)} para el mínimo (${vendidos.toFixed(0)}/${minimas.toFixed(0)} tn)`
    : null;

  const ejecutar = async () => {
    const res = await tokenizadasApi.liberarFondos(t.id);
    registrarTx({
      signature: res.txSignature,
      tipo: 'liberar',
      descripcion: `Cobro de siembra · ${t.campania.establecimiento?.nombre ?? t.campania.nombre}`,
      usdcMovido: res.montoUsd,
      timestamp: Date.now(),
    });
    qc.invalidateQueries({ queryKey: ['tk'] });
    const link = conectada ? explorerTxUrl(res.txSignature, conectada.network) : null;
    toast.success(`Cobraste ${usd(res.montoUsd, 2)} USDC`, {
      description: 'La plata salió del contrato directo a tu wallet.',
      action: link ? { label: 'Ver tx', onClick: () => window.open(link, '_blank', 'noreferrer') } : undefined,
    });
    return { txSignature: res.txSignature };
  };

  return (
    <>
      <div className={compacto ? 'flex flex-col items-end gap-1' : 'flex flex-col gap-2'}>
        <button
          onClick={() => setModal(true)}
          disabled={!puede}
          className="hv-cta"
          title={motivo ?? undefined}
          style={{ padding: compacto ? '8px 14px' : '12px 20px', fontSize: compacto ? 12 : 14, whiteSpace: 'nowrap' }}
        >
          Cobrar siembra
        </button>
        {motivo ? (
          <span style={{ color: 'var(--hv-text-muted)', fontSize: compacto ? 10 : 11, textAlign: compacto ? 'right' : 'left' }}>
            {motivo}
          </span>
        ) : (
          !compacto && (
            <span style={{ color: 'var(--hv-text-muted)', fontSize: 11 }}>
              Los inversores compraron. La plata sale del contrato directo a tu cuenta.
            </span>
          )
        )}
      </div>

      <FirmaTxModal
        open={modal}
        detalle={{
          titulo: 'Cobrar la siembra',
          descripcion:
            'Liberás los fondos del vault de la campaña hacia tu wallet. Después de esto no se venden más toneladas.',
          usdcAMover: recaudado,
          items: [
            { label: 'Campaña', value: t.campania.establecimiento?.nombre ?? t.campania.nombre },
            { label: 'Toneladas vendidas', value: `${vendidos.toFixed(0)} / ${Number(t.tokensEmitidos).toFixed(0)}` },
            { label: 'Precio por tonelada', value: usd(t.precioTokenUsd, 2) },
            { label: 'Recibís', value: `${usd(recaudado, 2)} USDC` },
          ],
        }}
        onAprobar={ejecutar}
        onCerrar={() => setModal(false)}
      />
    </>
  );
}
