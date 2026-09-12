import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { useWalletStore } from '../../stores/walletStore';
import { FirmaTxModal } from '../wallet/FirmaTxModal';
import { explorerTxUrl } from '../../utils/explorer';

/**
 * "Publicar campaña demo": un click y la campaña queda creada, aprobada y
 * publicada en Solana (create_campaign real). Es el atajo del speech: el
 * productor la publica acá, el inversor la compra en otro navegador y el
 * productor vuelve a cobrar la siembra.
 */
export function BotonPublicarDemo() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const conectada = useWalletStore((s) => s.conectada);
  const registrarTx = useWalletStore((s) => s.registrarTx);

  const ejecutar = async () => {
    const res = await tokenizadasApi.publicarDemo();
    registrarTx({
      signature: res.txSignature,
      tipo: 'publicar',
      descripcion: `Publicación · ${res.nombre}`,
      timestamp: Date.now(),
    });
    qc.invalidateQueries({ queryKey: ['tk'] });
    const link = conectada ? explorerTxUrl(res.txSignature, conectada.network) : null;
    toast.success('Campaña publicada en Solana', {
      description: `${res.toneladasOfrecidas} tn a US$ ${res.precioTokenUsd.toFixed(2)} · venta abierta 10 min`,
      action: link ? { label: 'Ver tx', onClick: () => window.open(link, '_blank', 'noreferrer') } : undefined,
    });
    return { txSignature: res.txSignature };
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModal(true)}
        disabled={!conectada}
        className="hv-cta-ghost"
        title={conectada ? 'Crea y publica una campaña demo en un click' : 'Conectá tu wallet'}
        style={{ padding: '11px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
      >
        ⚡ Publicar campaña demo
      </button>

      <FirmaTxModal
        open={modal}
        detalle={{
          titulo: 'Publicar la campaña',
          descripcion:
            'Se crea el contrato de la campaña en Solana: un token por tonelada y un vault en USDC donde entra la plata de los inversores.',
          items: [
            { label: 'Toneladas', value: '100 tn (1 token = 1 tn)' },
            { label: 'Precio', value: 'Pizarra Rosario US$ 250 − 5 %' },
            { label: 'Venta abierta', value: '10 minutos' },
            { label: 'Mínimo para cobrar', value: '10 tn' },
            { label: 'Liquidable', value: 'a los 12 minutos' },
          ],
        }}
        onAprobar={ejecutar}
        onCerrar={() => setModal(false)}
      />
    </>
  );
}
