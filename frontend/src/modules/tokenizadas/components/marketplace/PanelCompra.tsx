import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tokenizacion } from '../../types/tokenizadas';
import { usd, usdTn, toneladas, diasRestantes } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { FirmaTxModal } from '../wallet/FirmaTxModal';

interface Props {
  tokenizacion: Tokenizacion;
  disponibles: number;
}

/**
 * Panel de compra sticky que aparece a la derecha de la ficha de campaña.
 * Cantidad · total en vivo · botón "Comprar tokens" que dispara reserva + firma tx.
 */
export function PanelCompra({ tokenizacion: t, disponibles }: Props) {
  const conectada = useWalletStore((s) => s.conectada);
  const contexto = useWalletStore((s) => s.contextoActivo);
  const registrarTx = useWalletStore((s) => s.registrarTx);
  const [cantidad, setCantidad] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const qc = useQueryClient();

  const total = cantidad * t.precioTokenUsd;
  const pctProduccion = t.tokensEmitidos > 0 ? (cantidad / t.tokensEmitidos) * 100 : 0;
  const clampCantidad = Math.min(Math.max(1, cantidad), disponibles);

  const reservarMut = useMutation({
    mutationFn: async () => {
      if (!conectada) throw new Error('Conectá tu wallet');
      const r = await tokenizadasApi.reservar({
        tokenizacionId: t.id,
        cantidad: clampCantidad,
        inversorWallet: conectada.address,
      });
      setReservaId(r.reservaId);
      return r;
    },
    onSuccess: () => setModalOpen(true),
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmarCompra = async () => {
    if (!reservaId || !conectada) return;
    const res = await tokenizadasApi.confirmarCompra(reservaId);
    registrarTx({
      signature: res.txSignature,
      tipo: 'comprar',
      descripcion: `Compra ${res.tokens} tokens de ${t.campania.establecimiento?.nombre ?? 'campaña'}`,
      usdcMovido: res.montoTotalUsdc,
      timestamp: Date.now(),
    });
    qc.invalidateQueries({ queryKey: ['tk'] });
    toast.success(`Compra confirmada: ${res.tokens} tokens por ${usd(res.montoTotalUsdc, 2)}`);
  };

  const puedeComprar = !!conectada && (contexto === 'inversor' || contexto === 'productor');
  const razonNoPuede = !conectada
    ? 'Conectá tu wallet para comprar'
    : contexto === 'acopio'
    ? 'El rol Acopio no puede comprar tokens'
    : contexto === 'admin_plataforma'
    ? 'El admin no puede comprar tokens directamente'
    : null;

  return (
    <div className="bg-[#0F1216] border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-900/10">
      {/* Precio */}
      <div className="p-5 border-b border-white/5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">
          Precio por token
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-white tabular-nums">{usd(t.precioTokenUsd, 2)}</span>
          <span className="text-white/40 text-xs">/ tn</span>
        </div>
        <div className="text-[11px] text-white/40 mt-1">
          Referencia pizarra: <span className="text-white/70 tabular-nums">{usdTn(t.precioReferenciaUsdTn)}</span>
        </div>
      </div>

      {/* Cantidad */}
      <div className="p-5 border-b border-white/5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
          Cantidad
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-lg flex items-center justify-center transition-colors"
          >
            −
          </button>
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
            min={1}
            max={disponibles}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-center text-white text-lg font-semibold tabular-nums focus:outline-none focus:border-emerald-500/50"
          />
          <button
            onClick={() => setCantidad((c) => Math.min(disponibles, c + 1))}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-lg flex items-center justify-center transition-colors"
          >
            +
          </button>
        </div>
        <div className="flex justify-between text-[11px] text-white/40 mt-2">
          <span>tn</span>
          <span>
            Disponibles <span className="text-white/70 tabular-nums">{toneladas(disponibles, 0)}</span>
          </span>
        </div>
        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {[10, 50, 100, disponibles].filter((v) => v > 0).map((v, i) => (
            <button
              key={i}
              onClick={() => setCantidad(v)}
              className="py-1.5 text-[11px] rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors tabular-nums"
            >
              {i === 3 ? 'MAX' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Total + info */}
      <div className="p-5 border-b border-white/5 bg-black/20">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-white/60 text-sm">Total a pagar</span>
          <span className="text-white text-2xl font-semibold tabular-nums">{usd(total, 2)}</span>
        </div>
        <div className="flex justify-between text-[11px] text-white/40">
          <span>USDC</span>
          <span className="tabular-nums">= {pctProduccion.toFixed(2)}% de la producción</span>
        </div>
      </div>

      {/* Countdown */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Cierra en</span>
        <span className="text-white text-sm font-medium tabular-nums">{diasRestantes(t.fondeoHasta)}</span>
      </div>

      {/* Botón */}
      <div className="p-5">
        {puedeComprar ? (
          <button
            onClick={() => reservarMut.mutate()}
            disabled={reservarMut.isPending || disponibles === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {reservarMut.isPending ? 'Reservando...' : disponibles === 0 ? 'Sold out' : 'Comprar tokens'}
          </button>
        ) : (
          <button
            disabled
            className="w-full py-3 rounded-xl bg-white/5 text-white/40 text-sm cursor-not-allowed"
          >
            {razonNoPuede}
          </button>
        )}
        <p className="text-white/30 text-[10px] mt-3 leading-relaxed text-center">
          Al firmar, la transacción queda registrada on-chain. El monto USDC se transfiere del inversor al vault.
        </p>
      </div>

      <FirmaTxModal
        open={modalOpen}
        detalle={{
          titulo: `Compra ${clampCantidad} tokens`,
          descripcion: `Transfiere USDC al vault de la campaña y recibís los tokens en tu wallet.`,
          usdcAMover: total,
          items: [
            { label: 'Campaña', value: t.campania.establecimiento?.nombre ?? t.campania.nombre },
            { label: 'Cantidad', value: `${clampCantidad} tokens` },
            { label: 'Precio unitario', value: usd(t.precioTokenUsd, 2) },
            { label: 'Total', value: usd(total, 2) + ' USDC' },
          ],
        }}
        onAprobar={confirmarCompra}
        onRechazar={() => {
          setModalOpen(false);
          setReservaId(null);
        }}
      />
    </div>
  );
}
