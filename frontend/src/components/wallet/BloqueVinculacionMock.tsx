import { useMutation } from '@tanstack/react-query';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { tokenizadasService } from '@/services/tokenizadasService';
import { useAuthStore } from '@/stores/authStore';
import { extraerMensajeError } from '@/lib/apiClient';

/**
 * Bloque reutilizable que aparece cuando el usuario todavía no tiene wallet
 * vinculada. Se muestra en lugar de los botones que requieren firma. Al
 * confirmar, llama al endpoint mock que genera una address Solana y la
 * persiste en `Usuario.walletAddress`.
 *
 * Este componente tiene la interfaz idéntica a lo que sería el flujo real
 * con Phantom — cuando entre firma on-chain, se reemplaza la mutation por
 * `wallet.signMessage(...)` y nada más.
 */
export function BloqueVinculacionMock({
  motivo,
  onConectado,
}: {
  motivo?: string;
  onConectado?: (address: string) => void;
}) {
  const actualizarUsuario = useAuthStore((s) => s.actualizarUsuario);

  const conectar = useMutation({
    mutationFn: () => tokenizadasService.conectarWallet(),
    onSuccess: (data) => {
      actualizarUsuario({ walletAddress: data.address });
      toast.success('Wallet vinculada a tu cuenta');
      onConectado?.(data.address);
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <p className="font-semibold">Vinculá una wallet para continuar</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {motivo ?? 'Necesitamos una wallet para registrar tus operaciones on-chain. Se hace una sola vez.'}
      </p>
      <button
        type="button"
        onClick={() => conectar.mutate()}
        disabled={conectar.isPending}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
      >
        {conectar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        Vincular wallet
      </button>
      <p className="text-xs text-muted-foreground pt-2 border-t border-primary/10">
        Modo demo: la wallet se crea automáticamente y quedan cargados USDC mock para operar. En
        producción esta pantalla la resuelve Phantom / Solflare.
      </p>
    </div>
  );
}
