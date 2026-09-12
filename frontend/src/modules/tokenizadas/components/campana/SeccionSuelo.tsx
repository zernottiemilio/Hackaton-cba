import { useMemo } from 'react';
import { Mountain } from 'lucide-react';
import { generarSuelo } from '../../services/mockDatosTecnicosService';

/**
 * Datos técnicos del suelo del lote. Cada indicador se muestra junto a
 * un rango típico de la zona para dar contexto — un valor sin
 * comparación no significa nada al que no es agrónomo.
 */
export function SeccionSuelo({ tokenizacionId }: { tokenizacionId: string }) {
  const s = useMemo(() => generarSuelo(tokenizacionId), [tokenizacionId]);

  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Mountain className="h-4 w-4" style={{ color: '#B8814A' }} />
            Suelo
          </h3>
          <p className="text-white/40 text-xs mt-1">
            Textura, materia orgánica, pH y capacidad de retención hídrica.
          </p>
        </div>
        <div className="text-right">
          <div style={{ color: 'var(--hv-text)', fontSize: 13, fontWeight: 600 }}>{s.textura}</div>
          <div style={{ color: 'var(--hv-text-muted)', fontSize: 10, marginTop: 2 }}>
            Muestreo: {s.ultimoMuestreo}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BarraRango
          label="Materia orgánica"
          valor={s.materiaOrganicaPct}
          rango={s.materiaOrganicaRango}
          unidad="%"
          decimales={1}
        />
        <BarraRango label="pH" valor={s.ph} rango={s.phRango} unidad="" decimales={1} idealCentro />
        <BarraRango
          label="Retención hídrica"
          valor={s.capacidadRetencionMm}
          rango={s.capacidadRetencionRango}
          unidad=" mm"
          decimales={0}
        />
        <BarraRango
          label="Nitrógeno disponible"
          valor={s.nitrogenoKgHa}
          rango={s.nitrogenoRango}
          unidad=" kg/ha"
          decimales={0}
        />
      </div>

      <div
        className="mt-4 pt-3 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--hv-border-subtle)' }}
      >
        <span className="hv-label-sm" style={{ fontSize: 9 }}>Fuente</span>
        <span style={{ color: 'var(--hv-text-2)', fontSize: 11 }}>{s.fuente}</span>
      </div>
    </div>
  );
}

/**
 * Barra horizontal con marcador del valor dentro del rango típico.
 * Verde si está en rango, ámbar si está fuera. Para pH usamos `idealCentro`
 * (mejor cerca del centro) — para el resto, más alto = mejor.
 */
function BarraRango({
  label,
  valor,
  rango,
  unidad,
  decimales,
  idealCentro,
}: {
  label: string;
  valor: number;
  rango: [number, number];
  unidad: string;
  decimales: number;
  idealCentro?: boolean;
}) {
  const [min, max] = rango;
  const pct = Math.max(0, Math.min(100, ((valor - min) / (max - min)) * 100));
  const enRango = valor >= min && valor <= max;

  // Para pH lo ideal es estar cerca de 6.5 (centro del rango típico 5.5-7.5).
  // Para MO/retención/N: más alto es mejor, con 60% del rango como umbral bueno.
  const alerta = idealCentro
    ? Math.abs(pct - 50) > 40
    : pct < 30;
  const color = !enRango
    ? 'var(--hv-red-text)'
    : alerta
    ? 'var(--hv-amber-text)'
    : 'var(--hv-green-text)';
  const barColor = !enRango ? 'var(--hv-red)' : alerta ? 'var(--hv-amber)' : 'var(--hv-green)';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--hv-border-subtle)',
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="hv-label-sm" style={{ fontSize: 9 }}>{label}</span>
        <span className="hv-mono" style={{ color, fontSize: 15, fontWeight: 600 }}>
          {valor.toFixed(decimales)}
          {unidad}
        </span>
      </div>
      <div
        className="mt-2 relative"
        style={{
          height: 4,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 2,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: -2,
            transform: 'translateX(-50%)',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: barColor,
            boxShadow: `0 0 8px ${barColor}`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1.5" style={{ color: 'var(--hv-text-muted)', fontSize: 9 }}>
        <span>{min}</span>
        <span>rango típico</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
