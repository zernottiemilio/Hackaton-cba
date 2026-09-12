import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { tokenizadasApi } from '../../services/tokenizadasService';
import type { EstadoOnChain } from '../../types/tokenizadas';
import { abreviarAddress, usd, usdTn, toneladas } from '../../utils/format';

/**
 * Panel on-chain de una tokenización. Consume `GET /tokenizadas/:id/on-chain`
 * cada 10s y muestra los números que el jurado tiene que poder verificar
 * clickeando al Solana Explorer (VAL-21).
 *
 * Regla visual: `hv-dato` (azul) solo para cifras de plata (vault, payout,
 * precio). Verde queda para el estado de la campaña. Ver §6 hackaton.md.
 */
export function PanelOnChain({ tokenizacionId, compacto = false }: { tokenizacionId: string; compacto?: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tk', 'on-chain', tokenizacionId],
    queryFn: () => tokenizadasApi.estadoOnChain(tokenizacionId),
    refetchInterval: 10_000,
    enabled: !!tokenizacionId,
  });

  if (isLoading) {
    return (
      <div className="bg-[var(--hv-bg-panel)] border border-[var(--hv-border)] rounded-2xl p-5 flex items-center gap-2 text-[var(--hv-text-muted)] text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Leyendo estado on-chain…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--hv-bg-panel)] border border-[var(--hv-red-strong)] rounded-2xl p-5 text-xs text-[var(--hv-red-text)]">
        No pudimos leer el estado on-chain.
      </div>
    );
  }

  if (!data.onChain) {
    return (
      <div className="bg-[var(--hv-bg-panel)] border border-[var(--hv-border)] rounded-2xl p-5">
        <Header status={data.status} compacto={compacto} />
        <p className="text-[var(--hv-text-muted)] text-xs mt-2 leading-relaxed">
          Todavía no publicada en Solana. Se emite el mint y el vault cuando el admin apruebe la campaña.
        </p>
      </div>
    );
  }

  const { addresses, explorer } = data;
  const disponibles = Math.max(0, data.tonsOffered - data.tonsSold);
  const pctVendido = data.tonsOffered > 0 ? (data.tonsSold / data.tonsOffered) * 100 : 0;

  return (
    <div className="bg-[var(--hv-bg-panel)] border border-[var(--hv-border)] rounded-2xl p-5 space-y-4">
      <Header status={data.status} compacto={compacto} />

      {/* Ventas: vendidas / ofrecidas */}
      <div>
        <div className="flex justify-between items-baseline">
          <span className="hv-label-sm">Ventas on-chain</span>
          <span className="text-[var(--hv-text-2)] text-[11px] tabular-nums">
            {toneladas(data.tonsSold, 0)} · {toneladas(disponibles, 0)} disponibles
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-[var(--hv-green)] transition-all"
            style={{ width: `${Math.min(100, pctVendido)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-[var(--hv-text-muted)]">
          <span>{data.tonsSold}/{data.tonsOffered} tokens</span>
          <span>mín. {data.minTons}</span>
        </div>
      </div>

      {/* Cifras de plata — azul dato */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--hv-border-subtle)]">
        <Cifra label="Vault" valor={usd(data.vaultBalanceUsd, 0)} tono="dato" />
        <Cifra label="Precio token" valor={usdTn(data.pricePerTonUsd)} tono="dato" />
        {data.status === 'settled' && data.payoutPerTokenUsd !== null && (
          <Cifra label="Payout por token" valor={usdTn(data.payoutPerTokenUsd)} tono="dato" ancho />
        )}
      </div>

      {/* Addresses con links al explorer */}
      <div className="pt-2 border-t border-[var(--hv-border-subtle)] space-y-2">
        <FilaAddress label="Campaign" address={addresses.campaign} url={explorer.campaign} />
        <FilaAddress label="Mint" address={addresses.tokenMint} url={explorer.tokenMint} />
        <FilaAddress label="Vault" address={addresses.vault} url={explorer.vault} />
      </div>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────

const STATUS_STYLE: Record<EstadoOnChain['status'], { label: string; chip: string }> = {
  draft:    { label: 'Sin publicar', chip: 'hv-chip' },
  open:     { label: 'Abierta',      chip: 'hv-chip hv-chip-green' },
  funded:   { label: 'Fondeada',     chip: 'hv-chip hv-chip-green' },
  settled:  { label: 'Liquidada',    chip: 'hv-chip hv-chip-green' },
  refunded: { label: 'Devuelta',     chip: 'hv-chip hv-chip-amber' },
};

function Header({ status, compacto }: { status: EstadoOnChain['status']; compacto: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <div className="flex items-center justify-between">
      <h3 className={`text-[var(--hv-text)] font-semibold ${compacto ? 'text-xs' : 'text-sm'}`}>
        Estado on-chain
      </h3>
      <span className={s.chip} style={{ fontSize: 11 }}>
        <span className="hv-dot" style={{ background: 'currentColor' }} />
        {s.label}
      </span>
    </div>
  );
}

function Cifra({ label, valor, tono, ancho }: { label: string; valor: string; tono?: 'dato'; ancho?: boolean }) {
  return (
    <div className={ancho ? 'col-span-2' : ''}>
      <div className="hv-label-sm">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${tono === 'dato' ? 'hv-dato' : 'text-[var(--hv-text)]'}`}>
        {valor}
      </div>
    </div>
  );
}

function FilaAddress({ label, address, url }: { label: string; address: string | null; url: string | null }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      /* clipboard puede fallar en http */
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="hv-label-sm w-16 shrink-0">{label}</span>
      {address ? (
        <>
          <span className="hv-mono text-[var(--hv-text-2)] flex-1 truncate" title={address}>
            {abreviarAddress(address, 6, 6)}
          </span>
          <button
            type="button"
            onClick={copiar}
            className="p-1 rounded hover:bg-white/5 text-[var(--hv-text-muted)] hover:text-[var(--hv-text)] transition-colors"
            aria-label={`Copiar ${label}`}
          >
            {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded hover:bg-white/5 text-[var(--hv-text-muted)] hover:text-[var(--hv-green-text)] transition-colors"
              aria-label={`Ver ${label} en explorer`}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="p-1 opacity-30" title="Cluster mock — sin explorer">
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </>
      ) : (
        <span className="text-[var(--hv-text-muted)] italic">—</span>
      )}
    </div>
  );
}
