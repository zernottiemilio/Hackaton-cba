import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { camposApi } from '../../services/camposService';
import { WizardSteps } from '../../components/shared/WizardSteps';
import { SelectorModoTokenizacion } from '../../components/campana/SelectorModoTokenizacion';
import { hectareas, toneladas } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';
import type { ModoTokenizacion } from '../../types/tokenizadas';

const PASOS = ['La campaña', 'Cuánto tokenizar', 'Cotización', 'Garantías'];

interface FormState {
  campoId: string;
  cultivoId: string;
  cicloAgricola: string;
  hectareas: number;
  fechaSiembra: string;
  fechaCosecha: string;
  rindeEstimadoTnHa: number;

  modo: ModoTokenizacion | null;
  valorModo: number;
  rindeSimuladoPct: number;
}

const inicial: FormState = {
  campoId: '',
  cultivoId: '',
  cicloAgricola: cicloDefault(),
  hectareas: 0,
  fechaSiembra: '',
  fechaCosecha: '',
  rindeEstimadoTnHa: 0,
  modo: null,
  valorModo: 30,
  rindeSimuladoPct: 100,
};

function cicloDefault(): string {
  const anio = new Date().getFullYear();
  return `${anio}/${String((anio + 1) % 100).padStart(2, '0')}`;
}

export function NuevaCampanaPage() {
  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState<FormState>(inicial);
  const navigate = useNavigate();
  const conectada = useWalletStore((s) => s.conectada);

  const { data: campos = [] } = useQuery({
    queryKey: ['tk', 'campos'],
    queryFn: () => camposApi.listar(),
    enabled: !!conectada,
  });
  const { data: cultivos = [] } = useQuery({
    queryKey: ['tk', 'cultivos'],
    queryFn: () => camposApi.cultivos(),
  });

  const campoElegido = useMemo(() => campos.find((c) => c.id === form.campoId), [campos, form.campoId]);
  const cultivoElegido = useMemo(() => cultivos.find((c) => c.id === form.cultivoId), [cultivos, form.cultivoId]);

  // Cuando cambia el campo, precargar hectáreas
  useEffect(() => {
    if (campoElegido) {
      const sup = Number(campoElegido.superficieTotalHa ?? 0);
      if (form.hectareas === 0 || form.hectareas > sup) {
        setForm((f) => ({ ...f, hectareas: sup }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.campoId]);

  const produccionEstimadaTn = form.hectareas * form.rindeEstimadoTnHa;
  const promedioZonalTnHa: Record<string, number> = { soja: 3.5, 'maíz': 8.0, trigo: 4.0, girasol: 2.4 };
  const promedioZonal = cultivoElegido ? promedioZonalTnHa[cultivoElegido.nombre] ?? 3.5 : 3.5;
  const excedeHistorico = form.rindeEstimadoTnHa > promedioZonal * 1.15;

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const puedeAvanzar0 =
    form.campoId &&
    form.cultivoId &&
    form.cicloAgricola &&
    form.hectareas > 0 &&
    form.fechaSiembra &&
    form.fechaCosecha &&
    form.rindeEstimadoTnHa > 0;
  const puedeAvanzar1 = !!form.modo && form.valorModo > 0;

  if (!conectada) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <div className="text-5xl mb-4 opacity-70">🌾</div>
        <h1 className="text-white text-2xl font-semibold mb-2">Conectá tu wallet</h1>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/tk/campanas" className="text-white/40 hover:text-white/80 text-xs mb-4 inline-flex items-center gap-1">
        ← Mis campañas
      </Link>

      <div className="mb-6">
        <h1 className="text-white text-2xl font-semibold">Nueva campaña tokenizada</h1>
        <p className="text-white/40 text-xs mt-0.5">
          4 pasos. Al final enviás a revisión y ADMIN aprueba antes de publicarla al marketplace.
        </p>
      </div>

      <div className="mb-8">
        <WizardSteps pasos={PASOS} actual={paso} />
      </div>

      {/* Paso 1: La campaña */}
      {paso === 0 && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Campo *">
              {campos.length === 0 ? (
                <div className="text-white/40 text-sm italic p-3 border border-dashed border-white/10 rounded-lg">
                  No tenés campos cargados.{' '}
                  <Link to="/tk/campos/nuevo" className="text-emerald-400 hover:underline">
                    Cargá uno primero
                  </Link>
                </div>
              ) : (
                <select
                  value={form.campoId}
                  onChange={(e) => upd('campoId', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">Elegí un campo</option>
                  {campos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} — {hectareas(Number(c.superficieTotalHa ?? 0))}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Cultivo *">
              <select
                value={form.cultivoId}
                onChange={(e) => upd('cultivoId', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">Elegí un cultivo</option>
                {cultivos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ciclo agrícola *">
              <input
                type="text"
                value={form.cicloAgricola}
                onChange={(e) => upd('cicloAgricola', e.target.value)}
                placeholder="2026/27"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </Field>
            <Field label="Hectáreas afectadas *">
              <div className="relative">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={campoElegido ? Number(campoElegido.superficieTotalHa ?? 999999) : undefined}
                  value={form.hectareas || ''}
                  onChange={(e) => upd('hectareas', Number(e.target.value) || 0)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 pr-12 text-white text-right tabular-nums focus:outline-none focus:border-emerald-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">ha</span>
              </div>
              {campoElegido && (
                <p className="text-white/30 text-[11px] mt-1">
                  Superficie del campo: {hectareas(Number(campoElegido.superficieTotalHa ?? 0))}
                </p>
              )}
            </Field>
            <Field label="Fecha siembra estimada *">
              <input
                type="date"
                value={form.fechaSiembra}
                onChange={(e) => upd('fechaSiembra', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </Field>
            <Field label="Fecha cosecha estimada *">
              <input
                type="date"
                value={form.fechaCosecha}
                onChange={(e) => upd('fechaCosecha', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </Field>
            <Field label="Rinde estimado * (tn/ha)" className="md:col-span-2">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={Math.max(15, promedioZonal * 1.5)}
                  step={0.1}
                  value={form.rindeEstimadoTnHa}
                  onChange={(e) => upd('rindeEstimadoTnHa', Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <div className="relative w-32">
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={form.rindeEstimadoTnHa || ''}
                    onChange={(e) => upd('rindeEstimadoTnHa', Number(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 pr-12 text-white text-right tabular-nums focus:outline-none focus:border-emerald-500/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-[10px]">tn/ha</span>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[11px]">
                <span className="text-white/40">
                  Promedio zonal: <span className="text-white/70 tabular-nums">{promedioZonal.toFixed(1)} tn/ha</span>
                </span>
                {excedeHistorico && (
                  <span className="text-amber-400 font-medium">
                    ⚠ Estás estimando por encima del promedio zonal
                  </span>
                )}
              </div>
            </Field>
          </div>

          {/* Producción estimada — resultado grande */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-700/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <div className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                Producción estimada
              </div>
              <div className="text-white text-3xl font-semibold tabular-nums mt-1">
                {toneladas(produccionEstimadaTn, 0)}
              </div>
              <div className="text-white/50 text-xs mt-1">
                {form.hectareas > 0 && form.rindeEstimadoTnHa > 0
                  ? `${form.hectareas} ha × ${form.rindeEstimadoTnHa} tn/ha`
                  : 'Cargá hectáreas y rinde para verlo'}
              </div>
            </div>
            <div className="text-6xl opacity-30">🌾</div>
          </div>
        </section>
      )}

      {/* Paso 2: SelectorModoTokenizacion */}
      {paso === 1 && (
        <section>
          <div className="mb-4">
            <h2 className="text-white font-semibold">¿Cómo querés tokenizar?</h2>
            <p className="text-white/40 text-xs mt-0.5">
              Elegí el modo y movele el slider de rinde real para ver el impacto.
            </p>
          </div>
          <SelectorModoTokenizacion
            produccionEstimadaTn={produccionEstimadaTn}
            modo={form.modo}
            valor={form.valorModo}
            rindeSimuladoPct={form.rindeSimuladoPct}
            onModoCambia={(m) => upd('modo', m)}
            onValorCambia={(v) => upd('valorModo', v)}
            onRindeSimuladoCambia={(p) => upd('rindeSimuladoPct', p)}
          />
        </section>
      )}

      {/* Pasos 3 y 4 — placeholder (Sprint 3) */}
      {paso === 2 && (
        <PlaceholderProximo
          titulo="Cotización"
          descripcion="Fuente de precio (pizarra Rosario / MATBA / manual), slider de descuento, cotización dinámica opcional, tasa implícita."
          sprint="Sprint 3"
        />
      )}
      {paso === 3 && (
        <PlaceholderProximo
          titulo="Garantías + revisión"
          descripcion="Seguros, aval SGR, sobrecolateralización, vista previa y envío a revisión."
          sprint="Sprint 3"
        />
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
        <button
          onClick={() => (paso === 0 ? navigate('/tk/campanas') : setPaso(paso - 1))}
          className="px-4 py-2 rounded-lg text-white/60 hover:text-white text-sm"
        >
          {paso === 0 ? 'Cancelar' : '← Atrás'}
        </button>
        <div className="flex items-center gap-3">
          {paso < PASOS.length - 1 ? (
            <button
              onClick={() => setPaso(paso + 1)}
              disabled={(paso === 0 && !puedeAvanzar0) || (paso === 1 && !puedeAvanzar1)}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={() => toast.info('Pasos 3 y 4 quedan para Sprint 3')}
              className="px-5 py-2.5 rounded-lg bg-white/5 text-white/40 text-sm cursor-not-allowed"
              disabled
            >
              Enviar a revisión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function PlaceholderProximo({ titulo, descripcion, sprint }: { titulo: string; descripcion: string; sprint: string }) {
  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-10 text-center">
      <div className="text-4xl mb-3 opacity-40">⏳</div>
      <h3 className="text-white text-lg font-semibold">{titulo}</h3>
      <p className="text-white/40 text-sm mt-1 max-w-md mx-auto">{descripcion}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
        {sprint}
      </div>
    </div>
  );
}
