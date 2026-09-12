import { useState } from 'react';
import type { Tokenizacion } from '../../types/tokenizadas';
import { usd, usdTn, toneladas, diasRestantes, porcentaje } from '../../utils/format';
import { useWalletStore, useContextoActivo } from '../../stores/walletStore';
import { SheetCompra } from './SheetCompra';

interface Props {
  tokenizacion: Tokenizacion;
  disponibles: number;
}

/**
 * Panel sticky en la ficha. Muestra precio HRV + cantidad rápida + total.
 * Al cliquear "Comprar HRV" abre el SheetCompra 3 pasos (con reserva TTL).
 */
export function PanelCompra({ tokenizacion: t, disponibles }: Props) {
  const conectada = useWalletStore((s) => s.conectada);
  const contexto = useContextoActivo();
  const [cantidad, setCantidad] = useState(10);
  const [sheetOpen, setSheetOpen] = useState(false);

  const total = cantidad * t.precioTokenUsd;
  const pctProduccion = t.tokensEmitidos > 0 ? (cantidad / t.tokensEmitidos) * 100 : 0;
  const clampCantidad = Math.min(Math.max(1, cantidad), disponibles);

  // Espejo de la regla on-chain: invest exige now < sale_end. Si la venta
  // cerró, no abrimos la sheet: el programa la rechazaría igual.
  const ventaCerrada = new Date(t.fondeoHasta).getTime() <= Date.now();
  const puedeComprar = !!conectada && !ventaCerrada && (contexto === 'inversor' || contexto === 'productor');
  const razonNoPuede = ventaCerrada
    ? 'Venta cerrada'
    : !conectada
    ? 'Conectá tu wallet para comprar'
    : contexto === 'acopio'
    ? 'El rol Acopio no puede comprar HRV'
    : contexto === 'admin_plataforma'
    ? 'El admin no puede comprar HRV directamente'
    : null;

  return (
    <>
      <div
        style={{
          background: 'var(--hv-bg-panel)',
          border: '1px solid rgba(43,224,106,0.22)',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(43,224,106,0.08), var(--hv-inset-top)',
        }}
      >
        {/* Precio */}
        <div className="p-5" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
          <div className="hv-label" style={{ fontSize: 10 }}>Precio por HRV</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="hv-mono"
              style={{ fontSize: 30, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.025em', lineHeight: 1 }}
            >
              {usd(t.precioTokenUsd, 2)}
            </span>
            <span className="hv-label-sm" style={{ fontSize: 10 }}>/ tn</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--hv-text-muted)', marginTop: 5 }}>
            <span className="hv-mono" style={{ color: 'var(--hv-green-text)' }}>
              {porcentaje(-t.descuentoPct, 1)}
            </span>{' '}
            vs pizarra ·{' '}
            <span className="hv-mono">{usdTn(t.precioReferenciaUsdTn)}</span>
          </div>
        </div>

        {/* Cantidad */}
        <div className="p-5" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
          <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>Cantidad</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCantidad((c) => Math.max(1, c - 1))} style={btnStep}>−</button>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
              min={1}
              max={disponibles}
              className="hv-mono"
              style={{
                flex: 1,
                background: 'var(--hv-bg-input)',
                border: '1px solid var(--hv-border)',
                borderRadius: 10,
                padding: '10px',
                textAlign: 'center',
                color: 'var(--hv-text)',
                fontSize: 18,
                fontWeight: 600,
              }}
            />
            <button
              onClick={() => setCantidad((c) => Math.min(disponibles, c + 1))}
              style={btnStep}
            >
              ＋
            </button>
          </div>
          <div className="flex justify-between mt-2" style={{ fontSize: 11 }}>
            <span className="hv-label-sm" style={{ fontSize: 10 }}>HRV</span>
            <span className="hv-mono" style={{ color: 'var(--hv-text-muted)' }}>
              disp: <span style={{ color: 'var(--hv-text-2)' }}>{toneladas(disponibles, 0)}</span>
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {[10, 50, 100, disponibles].filter((v) => v > 0).map((v, i) => (
              <button
                key={i}
                onClick={() => setCantidad(v)}
                className="hv-mono"
                style={{
                  padding: '6px',
                  borderRadius: 7,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--hv-border-subtle)',
                  color: 'var(--hv-text-muted)',
                  fontSize: 10.5,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {i === 3 && v === disponibles ? 'MAX' : v}
              </button>
            ))}
          </div>
        </div>

        {/* Total */}
        <div style={{ padding: 20, background: 'rgba(43,224,106,0.04)', borderBottom: '1px solid var(--hv-border-subtle)' }}>
          <div className="flex justify-between items-baseline mb-1">
            <span style={{ color: 'var(--hv-text-2)', fontSize: 13 }}>Total</span>
            <span className="hv-mono" style={{ color: 'var(--hv-text)', fontSize: 22, fontWeight: 600 }}>
              {usd(total, 2)}
            </span>
          </div>
          <div className="flex justify-between" style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
            <span className="hv-mono">USDC</span>
            <span className="hv-mono">{pctProduccion.toFixed(2)}% producción</span>
          </div>
        </div>

        {/* Countdown */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
          <span className="hv-label" style={{ fontSize: 10 }}>Cierra en</span>
          <span className="hv-mono" style={{ color: ventaCerrada ? 'var(--hv-amber-text)' : 'var(--hv-text)', fontSize: 13, fontWeight: 600 }}>
            {ventaCerrada ? `cerró ${new Date(t.fondeoHasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : diasRestantes(t.fondeoHasta)}
          </span>
        </div>

        {/* CTA */}
        <div className="p-5">
          {puedeComprar ? (
            <button
              onClick={() => setSheetOpen(true)}
              disabled={disponibles === 0}
              className="hv-cta"
              style={{ width: '100%', padding: '14px' }}
            >
              {disponibles === 0 ? 'Sold out' : 'Comprar HRV'}
            </button>
          ) : (
            <button
              disabled
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--hv-text-muted)',
                fontSize: 13,
                border: '1px solid var(--hv-border-subtle)',
                cursor: 'not-allowed',
                fontWeight: 600,
              }}
            >
              {razonNoPuede}
            </button>
          )}
          <p className="hv-label-sm" style={{ fontSize: 9, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
            Firma on-chain · sin custodia intermedia
          </p>
        </div>
      </div>

      <SheetCompra
        open={sheetOpen}
        tokenizacion={t}
        cantidad={clampCantidad}
        disponibles={disponibles}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

const btnStep: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--hv-border)',
  color: 'var(--hv-text)',
  fontSize: 16,
  cursor: 'pointer',
  fontFamily: 'var(--hv-font-mono)',
  fontWeight: 600,
};
