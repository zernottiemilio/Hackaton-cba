import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Tenencia } from '../../types/tokenizadas';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { useWalletStore } from '../../stores/walletStore';
import { FirmaTxModal } from '../wallet/FirmaTxModal';
import { explorerTxUrl } from '../../utils/explorer';
import { usd, porcentaje, toneladas } from '../../utils/format';

interface Props {
  t: Tenencia;
  /** Versión chica para filas de tabla. */
  compacto?: boolean;
}

/**
 * "Cobrar" del inversor: dispara redeem (POST /tokenizadas/reclamar).
 * El backend firma con la wallet custodial del inversor: quema sus HRV y
 * el vault le transfiere el USDC correspondiente. Una sola tx atómica.
 *
 * Reglas (espejo del programa on-chain):
 *  - `campania.estadoToken === 'liquidada'` (el acopio ya settled)
 *  - `tenencia.estado === 'activa'` (todavía no reclamó)
 *  - `tokenizacion.payoutPorTokenUsd > 0`
 *
 * Antes de confirmar muestra: tokens × payout = USDC a recibir, comparado
 * con lo invertido → ganancia/pérdida en USD y %. Después del cobro, toast
 * con signature + link al explorer, y el balance de la wallet se refresca
 * solo (lo hace FirmaTxModal al confirmar).
 */
export function BotonCobrarInversor({ t, compacto = false }: Props) {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const conectada = useWalletStore((s) => s.conectada);
  const registrarTx = useWalletStore((s) => s.registrarTx);

  const estadoTenencia = t.estado;
  const estadoCampana = t.tokenizacion.campania.estadoToken;

  // Ya cobrada → chip con link al explorer
  if (estadoTenencia === 'liquidada') {
    const link = t.txSignatureCobro && conectada ? explorerTxUrl(t.txSignatureCobro, conectada.network) : null;
    return (
      <span
        className="hv-chip"
        style={{
          fontSize: compacto ? 11 : 12,
          color: 'var(--hv-green-text)',
          borderColor: 'rgba(43,224,106,0.28)',
          background: 'var(--hv-green-soft)',
        }}
      >
        <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
        Cobrada
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'inherit', marginLeft: 6, textDecoration: 'none' }}
          >
            ↗
          </a>
        )}
      </span>
    );
  }

  // Si no se puede cobrar todavía (campaña no liquidada o tenencia en disputa)
  // ocultamos el CTA. Un guión visual para no dejar la celda vacía.
  if (estadoCampana !== 'liquidada' || estadoTenencia !== 'activa') {
    return <span style={{ color: 'var(--hv-text-muted)', fontSize: 12 }}>—</span>;
  }

  // Cifras para la confirmación
  const tokens = Number(t.tokens);
  const payoutPorToken = Number(
    t.tokenizacion.payoutPorTokenUsd ?? t.tokenizacion.precioLiquidacionUsdTn ?? 0,
  );
  const aRecibir = tokens * payoutPorToken;
  const invertido = Number(t.montoTotalUsd);
  const resultado = aRecibir - invertido;
  const resultadoPct = invertido > 0 ? (resultado / invertido) * 100 : 0;
  const positivo = resultado >= 0;

  const puede = !!conectada && payoutPorToken > 0;
  const motivo = !conectada
    ? 'Conectá tu wallet para cobrar'
    : payoutPorToken === 0
      ? 'Payout aún no disponible'
      : null;

  const ejecutar = async () => {
    if (!conectada) throw new Error('Wallet no conectada');
    const res = await tokenizadasApi.reclamar({
      tenenciaId: t.id,
      inversorWallet: conectada.address,
    });
    registrarTx({
      signature: res.txSignature,
      tipo: 'reclamar',
      descripcion: `Cobro de tenencia · ${t.tokenizacion.campania.establecimiento?.nombre ?? t.tokenizacion.campania.nombre}`,
      usdcMovido: res.usdcRecibido,
      timestamp: Date.now(),
    });
    // Invalida portfolio, on-chain state y balance de wallet (FirmaTxModal
    // llama a `refrescar()` de walletStore automáticamente).
    qc.invalidateQueries({ queryKey: ['tk'] });
    const link = explorerTxUrl(res.txSignature, conectada.network);
    toast.success(`Cobraste ${usd(res.usdcRecibido, 2)} USDC`, {
      description: positivo
        ? `Ganancia realizada: ${usd(resultado, 2)} (${porcentaje(resultadoPct, 1)})`
        : `Pérdida realizada: ${usd(resultado, 2)} (${porcentaje(resultadoPct, 1)})`,
      action: link
        ? { label: 'Ver tx', onClick: () => window.open(link, '_blank', 'noreferrer') }
        : undefined,
    });
    return { txSignature: res.txSignature };
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation(); // no expandir la fila
          setModal(true);
        }}
        disabled={!puede}
        className="hv-cta"
        title={motivo ?? undefined}
        style={{
          padding: compacto ? '6px 14px' : '10px 18px',
          fontSize: compacto ? 12 : 14,
          whiteSpace: 'nowrap',
        }}
      >
        Cobrar
      </button>

      <FirmaTxModal
        open={modal}
        detalle={{
          titulo: 'Cobrar tu tenencia',
          descripcion:
            'Se queman tus tokens HRV y el vault de la campaña te transfiere el USDC correspondiente. Es una transacción atómica.',
          usdcAMover: aRecibir,
          items: [
            {
              label: 'Campaña',
              value: t.tokenizacion.campania.establecimiento?.nombre ?? t.tokenizacion.campania.nombre,
            },
            { label: 'Tokens', value: toneladas(tokens, 0) },
            { label: 'Payout por token', value: `${usd(payoutPorToken, 2)} / tn` },
            { label: 'USDC a recibir', value: usd(aRecibir, 2) },
            { label: 'Invertido', value: usd(invertido, 2) },
            {
              label: positivo ? 'Ganancia' : 'Pérdida',
              value: `${usd(resultado, 2)} · ${porcentaje(resultadoPct, 1)}`,
            },
          ],
        }}
        onAprobar={ejecutar}
        onCerrar={() => setModal(false)}
      />
    </>
  );
}
