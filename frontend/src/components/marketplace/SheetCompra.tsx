import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/Sheet';
import { BloqueVinculacionMock } from '@/components/wallet/BloqueVinculacionMock';
import { tokenizadasService, type DetalleMarketplace } from '@/services/tokenizadasService';
import { useAuthStore } from '@/stores/authStore';
import { extraerMensajeError } from '@/lib/apiClient';

const FMT_USD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

type Fase = 'idle' | 'reservando' | 'firmando' | 'confirmando' | 'listo';

interface Props {
  emision: DetalleMarketplace;
  cantidadInicial: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Sheet de compra: guía al inversor por reserva → firma → confirmación.
 * En modo mock, "firma" espera ~1s simulando la aprobación en Phantom.
 * En producción, esa etapa cambia por `wallet.signAndSendTransaction`.
 */
export function SheetCompra({ emision, cantidadInicial, open, onOpenChange }: Props) {
  const usuario = useAuthStore((s) => s.usuario);
  const queryClient = useQueryClient();

  const [cantidad, setCantidad] = useState(cantidadInicial);
  const [fase, setFase] = useState<Fase>('idle');
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [tenenciaId, setTenenciaId] = useState<string | null>(null);

  const precioToken = Number(emision.precioTokenUsd);
  const total = cantidad * precioToken;
  const disponible = emision.disponibilidad.tokensDisponibles;
  const walletAddress = usuario?.walletAddress;

  const reservar = useMutation({
    mutationFn: () =>
      tokenizadasService.reservar({
        tokenizacionId: emision.id,
        cantidad,
        inversorWallet: walletAddress!,
      }),
    onMutate: () => setFase('reservando'),
    onSuccess: async (data: { id: string }) => {
      setReservaId(data.id);
      setFase('firmando');
      // Simulamos la firma en Phantom antes de confirmar.
      await new Promise((r) => setTimeout(r, 1200));
      setFase('confirmando');
      confirmar.mutate(data.id);
    },
    onError: (err) => {
      setFase('idle');
      toast.error(extraerMensajeError(err));
    },
  });

  const confirmar = useMutation({
    mutationFn: (id: string) => tokenizadasService.confirmarCompra(id),
    onSuccess: async (data: { id: string }) => {
      setTenenciaId(data.id);
      setFase('listo');
      // Refrescamos los queries relevantes en background.
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-detalle', emision.id] });
      toast.success('Compra confirmada · tokens en tu portfolio');
    },
    onError: (err) => {
      setFase('idle');
      toast.error(extraerMensajeError(err));
    },
  });

  const cerrar = () => {
    setFase('idle');
    setReservaId(null);
    setTenenciaId(null);
    setCantidad(cantidadInicial);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (fase === 'idle' || fase === 'listo') && (o ? onOpenChange(o) : cerrar())}
      title={fase === 'listo' ? '¡Compra confirmada!' : 'Comprar tokens'}
      description={
        fase === 'listo'
          ? undefined
          : `${emision.campania.establecimiento?.nombre ?? 'Campo'} · ${emision.campania.cultivo?.nombre ?? ''}`
      }
    >
      {!walletAddress ? (
        <BloqueVinculacionMock motivo="La wallet firma cada operación de compra y recibe los tokens." />
      ) : fase === 'listo' ? (
        <div className="text-center space-y-3 py-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="text-sm text-muted-foreground">
            Se emitieron <span className="font-semibold text-foreground">{cantidad.toLocaleString('es-AR')} tokens</span>{' '}
            en tu wallet. Vas a poder cobrar la liquidación cuando la campaña se cierre.
          </p>
          {tenenciaId && (
            <p className="text-xs text-muted-foreground font-mono truncate px-4">Tenencia: {tenenciaId}</p>
          )}
          <button
            onClick={cerrar}
            className="w-full mt-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio por token</span>
              <span className="font-semibold">{FMT_USD.format(precioToken)}/tn</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Disponibles</span>
              <span className="font-semibold">{disponible.toLocaleString('es-AR')} tokens</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between">
              <span className="text-muted-foreground">Wallet</span>
              <span className="font-mono text-xs">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
            </div>
          </div>

          {/* Selector cantidad */}
          <div>
            <label className="text-xs text-muted-foreground">Cantidad a comprar (toneladas)</label>
            <input
              type="number"
              min={1}
              max={disponible}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Math.min(disponible, Number(e.target.value) || 1)))}
              disabled={fase !== 'idle'}
              className="mt-1 w-full h-11 px-3 rounded-lg border border-border bg-background text-lg font-semibold disabled:opacity-60"
            />
          </div>

          {/* Total */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <p className="text-xs text-primary uppercase tracking-wide">Total a pagar</p>
            <p className="text-2xl font-semibold text-primary">{FMT_USD.format(total)}</p>
            <p className="text-xs text-muted-foreground mt-1">Se transfieren desde tu wallet en USDC.</p>
          </div>

          {/* Aviso */}
          <div className="rounded-lg bg-muted/30 p-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              El pago queda bloqueado en el vault de la campaña hasta que se llegue al mínimo de
              fondeo. Si no se llega, se devuelve.
            </p>
          </div>

          {/* Estado */}
          {fase !== 'idle' && (
            <div className="rounded-lg bg-muted/40 p-3 flex items-center gap-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>
                {fase === 'reservando' && 'Reservando tokens…'}
                {fase === 'firmando' && 'Firmando transacción en tu wallet…'}
                {fase === 'confirmando' && 'Confirmando compra on-chain…'}
              </span>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={cerrar}
              disabled={fase !== 'idle'}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              <X className="h-4 w-4 inline mr-1" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => reservar.mutate()}
              disabled={fase !== 'idle' || cantidad <= 0 || cantidad > disponible}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              Firmar compra
            </button>
          </div>
          {reservaId && (
            <p className="text-xs text-muted-foreground font-mono truncate">Reserva: {reservaId}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
