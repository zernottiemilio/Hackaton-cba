import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapaLote, AreaBadge, superficiePoligonoHa } from '../../components/mapa/MapaLote';
import { ImportKmlButton } from '../../components/mapa/ImportKmlButton';
import { WizardSteps } from '../../components/shared/WizardSteps';
import { camposApi } from '../../services/camposService';
import { hectareas } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';

const PASOS = ['Ubicación', 'Identificación', 'Historial'];
const PROVINCIAS = ['Buenos Aires', 'Córdoba', 'Santa Fe', 'La Pampa', 'Entre Ríos'];
const CULTIVOS_HISTORIAL = ['soja', 'maíz', 'trigo', 'girasol', 'sorgo'];

interface FormState {
  poligono: GeoJSON.Polygon | null;
  superficieHa: number;
  superficieManual: number | null;
  nombre: string;
  partido: string;
  provincia: string;
  tenencia: 'propio' | 'arrendado' | 'mixto';
  acopioHabitualId: string;
  historial: { ciclo: string; cultivo: string; rindeTnHa: number }[];
}

const inicial: FormState = {
  poligono: null,
  superficieHa: 0,
  superficieManual: null,
  nombre: '',
  partido: '',
  provincia: 'Buenos Aires',
  tenencia: 'propio',
  acopioHabitualId: '',
  historial: [],
};

export function NuevoCampoPage() {
  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState<FormState>(inicial);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const conectada = useWalletStore((s) => s.conectada);

  const { data: acopios = [] } = useQuery({
    queryKey: ['tk', 'acopios'],
    queryFn: () => camposApi.acopios(),
  });

  const crearMut = useMutation({
    mutationFn: async () => {
      if (!form.poligono) throw new Error('Falta el polígono');
      return camposApi.crear({
        nombre: form.nombre,
        partido: form.partido,
        provincia: form.provincia,
        superficieHa: form.superficieManual ?? form.superficieHa,
        geometria: form.poligono,
        tenencia: form.tenencia,
        acopioHabitualId: form.acopioHabitualId || undefined,
        fotos: [],
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tk', 'campos'] });
      toast.success(`Campo "${data.nombre}" creado`);
      navigate('/tk/campos');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const puedeAvanzarPaso0 = !!form.poligono && (form.superficieManual ?? form.superficieHa) > 0;
  const puedeAvanzarPaso1 = form.nombre.trim().length >= 2 && form.partido.trim() && form.provincia.trim();

  if (!conectada) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <div className="text-5xl mb-4 opacity-70">⛰️</div>
        <h1 className="text-white text-2xl font-semibold mb-2">Conectá tu wallet</h1>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Volver */}
      <Link to="/tk/campos" className="text-white/40 hover:text-white/80 text-xs mb-4 inline-flex items-center gap-1">
        ← Mis campos
      </Link>

      <div className="mb-6">
        <h1 className="text-white text-2xl font-semibold">Nuevo campo</h1>
        <p className="text-white/40 text-xs mt-0.5">Dibujá el polígono, identificalo y opcionalmente cargá historial de rindes.</p>
      </div>

      {/* Steps */}
      <div className="mb-8">
        <WizardSteps pasos={PASOS} actual={paso} />
      </div>

      {/* Paso 1: Ubicación */}
      {paso === 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">Dibujá el polígono del lote</h2>
              <p className="text-white/40 text-xs mt-0.5">
                Usá la herramienta de dibujo del mapa o importá un KML.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AreaBadge poligono={form.poligono} />
              <ImportKmlButton
                onCargar={(p) => {
                  const area = superficiePoligonoHa(p);
                  upd('poligono', p);
                  upd('superficieHa', area);
                  upd('superficieManual', null);
                }}
              />
            </div>
          </div>
          <MapaLote
            modo={form.poligono ? 'editar' : 'dibujar'}
            poligono={form.poligono}
            onCambio={(p, area) => {
              upd('poligono', p);
              upd('superficieHa', area);
              upd('superficieManual', null);
            }}
            height={480}
          />
          <div className="bg-[#0F1216] border border-white/5 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Superficie calculada</div>
              <div className="text-white text-xl font-semibold tabular-nums mt-1">{hectareas(form.superficieHa)}</div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-white/50 text-xs">Corregir a mano</label>
              <input
                type="number"
                step={0.1}
                min={0}
                placeholder="ha"
                value={form.superficieManual ?? ''}
                onChange={(e) =>
                  upd('superficieManual', e.target.value ? Number(e.target.value) : null)
                }
                className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm text-right tabular-nums focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
        </section>
      )}

      {/* Paso 2: Identificación */}
      {paso === 1 && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nombre del lote *">
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => upd('nombre', e.target.value)}
                placeholder="La Escondida"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </FormField>
            <FormField label="Partido / departamento *">
              <input
                type="text"
                value={form.partido}
                onChange={(e) => upd('partido', e.target.value)}
                placeholder="Pergamino"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              />
            </FormField>
            <FormField label="Provincia *">
              <select
                value={form.provincia}
                onChange={(e) => upd('provincia', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              >
                {PROVINCIAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tenencia">
              <div className="grid grid-cols-3 gap-1 bg-white/5 rounded-lg p-1">
                {(['propio', 'arrendado', 'mixto'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => upd('tenencia', t)}
                    className={`py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      form.tenencia === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Acopio habitual" className="md:col-span-2">
              <select
                value={form.acopioHabitualId}
                onChange={(e) => upd('acopioHabitualId', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">Sin especificar</option>
                {acopios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.razonSocial}
                  </option>
                ))}
              </select>
              <p className="text-white/30 text-[11px] mt-1">
                Podés cambiar el acopio por campaña. Este es solo el default que sugerimos.
              </p>
            </FormField>
          </div>
        </section>
      )}

      {/* Paso 3: Historial */}
      {paso === 2 && (
        <section className="space-y-4">
          <div className="bg-[#0F1216] border border-white/5 rounded-xl p-4 text-white/60 text-sm">
            <p>
              <strong className="text-white/90">Opcional pero conviene.</strong> Los campos con historial cargado se
              fondean más rápido: los inversores confían más cuando pueden ver el rinde histórico real.
            </p>
          </div>
          <HistorialEditor
            historial={form.historial}
            onCambio={(h) => upd('historial', h)}
          />
        </section>
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
        <button
          onClick={() => (paso === 0 ? navigate('/tk/campos') : setPaso(paso - 1))}
          className="px-4 py-2 rounded-lg text-white/60 hover:text-white text-sm"
        >
          {paso === 0 ? 'Cancelar' : '← Atrás'}
        </button>
        <div className="flex items-center gap-3">
          {paso < PASOS.length - 1 ? (
            <button
              onClick={() => setPaso(paso + 1)}
              disabled={(paso === 0 && !puedeAvanzarPaso0) || (paso === 1 && !puedeAvanzarPaso1)}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={() => crearMut.mutate()}
              disabled={crearMut.isPending}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/40 disabled:opacity-40"
            >
              {crearMut.isPending ? 'Guardando...' : 'Crear campo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function HistorialEditor({
  historial,
  onCambio,
}: {
  historial: { ciclo: string; cultivo: string; rindeTnHa: number }[];
  onCambio: (h: { ciclo: string; cultivo: string; rindeTnHa: number }[]) => void;
}) {
  const agregar = () =>
    onCambio([...historial, { ciclo: '', cultivo: 'soja', rindeTnHa: 0 }]);
  const actualizar = (i: number, patch: Partial<{ ciclo: string; cultivo: string; rindeTnHa: number }>) => {
    onCambio(historial.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  };
  const eliminar = (i: number) => onCambio(historial.filter((_, idx) => idx !== i));

  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-white font-medium text-sm">Rindes por ciclo</h3>
        <button
          onClick={agregar}
          className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/80"
        >
          ＋ Agregar ciclo
        </button>
      </div>
      {historial.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">Sin historial cargado.</div>
      ) : (
        <div className="divide-y divide-white/5">
          {historial.map((h, i) => (
            <div key={i} className="p-3 grid grid-cols-[1fr_1fr_120px_auto] gap-2 items-center">
              <input
                type="text"
                placeholder="2024/25"
                value={h.ciclo}
                onChange={(e) => actualizar(i, { ciclo: e.target.value })}
                className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <select
                value={h.cultivo}
                onChange={(e) => actualizar(i, { cultivo: e.target.value })}
                className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                {CULTIVOS_HISTORIAL.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="relative">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  placeholder="3.5"
                  value={h.rindeTnHa || ''}
                  onChange={(e) => actualizar(i, { rindeTnHa: Number(e.target.value) || 0 })}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 pr-12 text-white text-sm text-right tabular-nums focus:outline-none focus:border-emerald-500/50"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 text-[10px]">tn/ha</span>
              </div>
              <button
                onClick={() => eliminar(i)}
                className="text-white/30 hover:text-rose-400 w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
