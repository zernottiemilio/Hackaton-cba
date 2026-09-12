import { motion } from 'framer-motion';

interface Garantias {
  tieneSeguroGranizo: boolean;
  tieneSeguroParametrico: boolean;
  tieneAvalSgr: boolean;
  sobrecolateralPct: number;
}

interface Props extends Garantias {
  onCambia: (patch: Partial<Garantias>) => void;
}

/**
 * Paso 4 del wizard: garantías + medidor de completitud.
 * Cada garantía sumada mejora el score que ve el inversor y acelera fondeo.
 */
export function PasoGarantias(p: Props) {
  const completitud = calcularCompletitud(p);

  return (
    <div className="space-y-5">
      {/* Medidor grande */}
      <div className="hv-glass" style={{ borderRadius: 16, padding: 24 }}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="hv-label" style={{ fontSize: 10 }}>Completitud de la oferta</div>
            <p style={{ fontSize: 12, color: 'var(--hv-text-muted)', marginTop: 4, maxWidth: 420 }}>
              Los inversores miran esto antes que nada. Cada garantía suma percepción de riesgo bajo.
            </p>
          </div>
          <div className="hv-mono" style={{ fontSize: 32, fontWeight: 600, color: coloresCompletitud(completitud), letterSpacing: '-0.03em' }}>
            {completitud}%
          </div>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completitud}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              height: '100%',
              borderRadius: 999,
              background:
                completitud >= 75
                  ? 'linear-gradient(90deg, var(--hv-green-deep), var(--hv-green))'
                  : completitud >= 40
                  ? 'linear-gradient(90deg, var(--hv-amber), #ffd27a)'
                  : 'linear-gradient(90deg, var(--hv-red), #ff9b9b)',
            }}
          />
        </div>
      </div>

      {/* Cards de garantías */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TarjetaGarantia
          activo={p.tieneSeguroGranizo}
          onToggle={(v) => p.onCambia({ tieneSeguroGranizo: v })}
          titulo="Seguro contra granizo"
          descripcion="Cubre pérdidas por evento climático puntual sobre el rinde estimado."
          icon="❄"
          badge="+15% completitud"
        />
        <TarjetaGarantia
          activo={p.tieneSeguroParametrico}
          onToggle={(v) => p.onCambia({ tieneSeguroParametrico: v })}
          titulo="Seguro paramétrico"
          descripcion="Se dispara automáticamente si el déficit hídrico supera cierto umbral."
          icon="⚡"
          badge="+20% completitud"
        />
        <TarjetaGarantia
          activo={p.tieneAvalSgr}
          onToggle={(v) => p.onCambia({ tieneAvalSgr: v })}
          titulo="Aval SGR"
          descripcion="Sociedad de Garantía Recíproca respalda una porción del capital."
          icon="✓"
          badge="+25% completitud"
        />
        <div
          style={{
            borderRadius: 14,
            padding: 18,
            border: `1px solid ${p.sobrecolateralPct > 0 ? 'rgba(43,224,106,0.28)' : 'var(--hv-border)'}`,
            background: p.sobrecolateralPct > 0 ? 'rgba(43,224,106,0.06)' : 'rgba(255,255,255,0.02)',
            boxShadow: 'var(--hv-inset-top)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: p.sobrecolateralPct > 0 ? 'var(--hv-green-soft)' : 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: p.sobrecolateralPct > 0 ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
              }}
            >
              ⚖
            </div>
            <div>
              <div style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 600 }}>Sobrecolateralización</div>
              <div style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
                USDC extra bloqueados en el vault, subastados si baja la cobertura.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={p.sobrecolateralPct}
              onChange={(e) => p.onCambia({ sobrecolateralPct: Number(e.target.value) })}
              style={{ flex: 1, accentColor: 'var(--hv-green)' }}
            />
            <span className="hv-mono" style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, width: 44, textAlign: 'right' }}>
              {p.sobrecolateralPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TarjetaGarantia({
  activo,
  onToggle,
  titulo,
  descripcion,
  icon,
  badge,
}: {
  activo: boolean;
  onToggle: (v: boolean) => void;
  titulo: string;
  descripcion: string;
  icon: string;
  badge: string;
}) {
  return (
    <button
      onClick={() => onToggle(!activo)}
      style={{
        textAlign: 'left',
        borderRadius: 14,
        padding: 18,
        border: `1px solid ${activo ? 'rgba(43,224,106,0.35)' : 'var(--hv-border)'}`,
        background: activo ? 'rgba(43,224,106,0.06)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: activo ? '0 0 24px rgba(43,224,106,0.12), var(--hv-inset-top)' : 'var(--hv-inset-top)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: activo ? 'var(--hv-green-soft)' : 'rgba(255,255,255,0.05)',
            border: activo ? '1px solid rgba(43,224,106,0.3)' : '1px solid var(--hv-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            color: activo ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
            flex: 'none',
          }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 600 }}>{titulo}</span>
            {activo && (
              <span className="hv-label-sm" style={{ fontSize: 9, color: 'var(--hv-green-text)' }}>
                {badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--hv-text-muted)', lineHeight: 1.5 }}>{descripcion}</p>
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `1px solid ${activo ? 'var(--hv-green)' : 'var(--hv-border-strong)'}`,
            background: activo ? 'var(--hv-green)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          {activo && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--hv-bg-token)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}

function calcularCompletitud(g: Garantias): number {
  let p = 20; // base por haber llegado hasta acá
  if (g.tieneSeguroGranizo) p += 15;
  if (g.tieneSeguroParametrico) p += 20;
  if (g.tieneAvalSgr) p += 25;
  if (g.sobrecolateralPct > 0) p += Math.min(20, Math.floor(g.sobrecolateralPct / 30 * 20));
  return Math.min(100, p);
}

function coloresCompletitud(pct: number): string {
  if (pct >= 75) return 'var(--hv-green-text)';
  if (pct >= 40) return 'var(--hv-amber-text)';
  return 'var(--hv-red-text)';
}
