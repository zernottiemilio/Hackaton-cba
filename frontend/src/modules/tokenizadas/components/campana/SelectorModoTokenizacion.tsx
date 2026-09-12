import { motion } from 'framer-motion';
import { toneladas } from '../../utils/format';
import type { ModoTokenizacion } from '../../types/tokenizadas';

interface Props {
  /** Producción estimada en tn (ha × rinde estimado). */
  produccionEstimadaTn: number;
  /** Modo seleccionado por el productor. */
  modo: ModoTokenizacion | null;
  /** Valor: si porcentual, el %; si fijo, las toneladas. */
  valor: number;
  /** Simulador de rinde: 100 = igual al estimado; 70 = 30% peor; 130 = 30% mejor. */
  rindeSimuladoPct: number;
  onModoCambia: (m: ModoTokenizacion) => void;
  onValorCambia: (v: number) => void;
  onRindeSimuladoCambia: (pct: number) => void;
}

/**
 * El corazón visual del wizard. Dos tarjetas grandes lado a lado con los
 * dos modos. Debajo, un slider de rinde real que anima los dos números
 * en simultáneo. **El movimiento del slider es la explicación** —
 * el texto solo acompaña.
 *
 * Al mover el slider a "rinde 30% peor":
 *  - Porcentual: entregás menos toneladas (300 → 210).
 *  - Fijo: tenés que entregar las 300 igual.
 *
 * Ese contraste visible-en-vivo es lo que le enseña al productor
 * quién asume el riesgo. Diseñado según §4 del hackaton.md.
 */
export function SelectorModoTokenizacion({
  produccionEstimadaTn,
  modo,
  valor,
  rindeSimuladoPct,
  onModoCambia,
  onValorCambia,
  onRindeSimuladoCambia,
}: Props) {
  const produccionSimulada = (produccionEstimadaTn * rindeSimuladoPct) / 100;

  // Valor por defecto de la card no seleccionada — se muestra en gris
  // hasta que el productor la elija.
  const porcentajeActual = modo === 'porcentual' ? valor : 30;
  const toneladasFijasActual = modo === 'fijo' ? valor : Math.round(produccionEstimadaTn * 0.3);

  const entregadoPorcentual = (produccionSimulada * porcentajeActual) / 100;
  const debeEntregarFijo = toneladasFijasActual; // no cambia con el rinde
  const equivalenciaFijoPct = produccionEstimadaTn > 0 ? (toneladasFijasActual / produccionEstimadaTn) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Dos tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Porcentual */}
        <TarjetaModo
          activo={modo === 'porcentual'}
          onClick={() => onModoCambia('porcentual')}
          color="amber"
          titulo="Un porcentaje"
          subtitulo="El inversor asume parte del riesgo de rinde"
        >
          <div className="mt-4">
            <label className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">
              Porcentaje de la producción
            </label>
            <div className="mt-2 flex items-baseline gap-2">
              <input
                type="range"
                min={5}
                max={80}
                step={1}
                value={porcentajeActual}
                onChange={(e) => {
                  onModoCambia('porcentual');
                  onValorCambia(Number(e.target.value));
                }}
                className="flex-1 accent-amber-400"
              />
              <span className="text-white text-2xl font-semibold tabular-nums w-14 text-right">
                {porcentajeActual}%
              </span>
            </div>
          </div>
          <ResultadoSimulacion
            titulo="Entregarías hoy"
            valor={toneladas((produccionEstimadaTn * porcentajeActual) / 100, 0)}
            titulo2={`Si el rinde real es ${rindeSimuladoPct}% del estimado`}
            valor2={toneladas(entregadoPorcentual, 0)}
            impacto={rindeSimuladoPct - 100}
          />
          <MinutasRiesgo
            listado={[
              { label: 'Si el rinde cae, entregás menos', color: 'buena' },
              { label: 'Si sube, entregás más', color: 'neutra' },
              { label: 'Menor riesgo para vos', color: 'buena' },
              { label: 'Mayor descuento a ofrecer', color: 'mala' },
            ]}
          />
        </TarjetaModo>

        {/* Fijo */}
        <TarjetaModo
          activo={modo === 'fijo'}
          onClick={() => onModoCambia('fijo')}
          color="emerald"
          titulo="Una cantidad fija"
          subtitulo="El productor asume el riesgo de rinde"
        >
          <div className="mt-4">
            <label className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">
              Toneladas comprometidas
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={Math.floor(produccionEstimadaTn)}
                step={10}
                value={toneladasFijasActual}
                onChange={(e) => {
                  onModoCambia('fijo');
                  onValorCambia(Number(e.target.value));
                }}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xl font-semibold text-right tabular-nums focus:outline-none focus:border-emerald-500/50"
              />
              <span className="text-white/50 text-sm">tn</span>
            </div>
            <div className="text-white/40 text-[11px] mt-1">
              ≈ {equivalenciaFijoPct.toFixed(0)}% de tu estimación
            </div>
          </div>
          <ResultadoSimulacion
            titulo="Tenés que entregar"
            valor={toneladas(debeEntregarFijo, 0)}
            titulo2={`Con rinde ${rindeSimuladoPct}%, seguís debiendo`}
            valor2={toneladas(debeEntregarFijo, 0)}
            impacto={0}
            fijo
          />
          <MinutasRiesgo
            listado={[
              { label: 'Sea cual sea el rinde, entregás lo pactado', color: 'neutra' },
              { label: 'Si sube, el excedente es tuyo', color: 'buena' },
              { label: 'Mayor riesgo para vos', color: 'mala' },
              { label: 'Menor descuento (más plata neta)', color: 'buena' },
            ]}
          />
        </TarjetaModo>
      </div>

      {/* Slider de simulación de rinde */}
      <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold text-sm">Simulá tu rinde real</h3>
            <p className="text-white/40 text-xs mt-0.5">
              Movelo para ver cómo cambia lo que entregás en cada modo.
            </p>
          </div>
          <div className="text-right">
            <div className="text-white text-2xl font-semibold tabular-nums">{rindeSimuladoPct}%</div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">del estimado</div>
          </div>
        </div>
        <input
          type="range"
          min={40}
          max={140}
          step={1}
          value={rindeSimuladoPct}
          onChange={(e) => onRindeSimuladoCambia(Number(e.target.value))}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>-60% (mala campaña)</span>
          <span className="text-white/60 tabular-nums font-medium">
            ≈ {toneladas(produccionSimulada, 0)} totales
          </span>
          <span>+40% (excelente)</span>
        </div>
      </div>
    </div>
  );
}

function TarjetaModo({
  activo,
  onClick,
  color,
  titulo,
  subtitulo,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  color: 'amber' | 'emerald';
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  const ring = activo
    ? color === 'amber'
      ? 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-900/20'
      : 'ring-2 ring-emerald-500/60 shadow-lg shadow-emerald-900/20'
    : 'ring-1 ring-white/5 hover:ring-white/15';
  const dot = color === 'amber' ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: activo ? 0 : -2 }}
      className={`relative text-left rounded-2xl bg-[#0F1216] p-5 transition-all ${ring}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${dot} ${activo ? 'animate-pulse' : 'opacity-50'}`} />
        <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">
          {color === 'amber' ? 'Porcentual' : 'Fijo'}
        </span>
      </div>
      <h4 className="text-white text-xl font-semibold">{titulo}</h4>
      <p className="text-white/50 text-xs mt-1">{subtitulo}</p>
      {children}
    </motion.button>
  );
}

function ResultadoSimulacion({
  titulo,
  valor,
  titulo2,
  valor2,
  impacto,
  fijo,
}: {
  titulo: string;
  valor: string;
  titulo2: string;
  valor2: string;
  impacto: number;
  fijo?: boolean;
}) {
  return (
    <div className="mt-5 pt-4 border-t border-white/5 space-y-2">
      <div>
        <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">{titulo}</div>
        <div className="text-white text-lg font-semibold tabular-nums">{valor}</div>
      </div>
      <motion.div
        key={valor2}
        initial={{ opacity: 0.5, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">{titulo2}</div>
        <div
          className={`text-lg font-semibold tabular-nums ${
            fijo ? 'text-white' : impacto < 0 ? 'text-rose-400' : impacto > 0 ? 'text-emerald-400' : 'text-white'
          }`}
        >
          {valor2}
        </div>
      </motion.div>
    </div>
  );
}

function MinutasRiesgo({
  listado,
}: {
  listado: { label: string; color: 'buena' | 'mala' | 'neutra' }[];
}) {
  return (
    <ul className="mt-4 space-y-1.5">
      {listado.map((l, i) => (
        <li key={i} className="flex items-start gap-2 text-xs">
          <span
            className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${
              l.color === 'buena' ? 'bg-emerald-400' : l.color === 'mala' ? 'bg-rose-400' : 'bg-white/40'
            }`}
          />
          <span
            className={`${
              l.color === 'buena' ? 'text-white/80' : l.color === 'mala' ? 'text-white/60' : 'text-white/70'
            }`}
          >
            {l.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
