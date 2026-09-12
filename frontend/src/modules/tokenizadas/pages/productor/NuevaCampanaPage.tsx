import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { camposApi } from '../../services/camposService';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { WizardSteps } from '../../components/shared/WizardSteps';
import { SelectorModoTokenizacion } from '../../components/campana/SelectorModoTokenizacion';
import { CalculadoraCotizacion } from '../../components/campana/CalculadoraCotizacion';
import { PasoGarantias } from '../../components/campana/PasoGarantias';
import { hectareas, toneladas, usd, usdCompacto } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';
import type { ModoTokenizacion, FuentePrecio } from '../../types/tokenizadas';
import { normalizarCultivo } from '../../services/mockPreciosService';
import { FirmaTxModal } from '../../components/wallet/FirmaTxModal';

const PASOS = ['La campaña', 'Cuánto tokenizar', 'Cotización', 'Garantías'];
const promedioZonalTnHa: Record<string, number> = { soja: 3.5, 'maíz': 8.0, trigo: 4.0, girasol: 2.4 };

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

  fuentePrecio: FuentePrecio;
  precioReferenciaUsdTn: number;
  descuentoPct: number;
  precioDinamico: boolean;
  precioPisoUsd: number | null;
  /** Formato datetime-local ("YYYY-MM-DDTHH:mm"). Se convierte a ISO al enviar. */
  fondeoDesde: string;
  fondeoHasta: string;
  /** datetime-local. settlement_date on-chain. Vacío = backend usa fondeoHasta + 90 días. */
  fechaLiquidacionEstimada: string;
  /** min_tons on-chain. 0 = usar el sugerido (2/3 de lo ofrecido). */
  toneladasMinimas: number;

  tieneSeguroGranizo: boolean;
  tieneSeguroParametrico: boolean;
  tieneAvalSgr: boolean;
  sobrecolateralPct: number;
}

/** Date → valor para <input type="datetime-local"> en hora local. */
function aLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** datetime-local → ISO 8601 (lo que valida el DTO del backend). */
function aIso(local: string): string {
  return new Date(local).toISOString();
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
  fuentePrecio: 'pizarra_rosario',
  precioReferenciaUsdTn: 310,
  descuentoPct: 7,
  precioDinamico: false,
  precioPisoUsd: null,
  fondeoDesde: '',
  fondeoHasta: '',
  fechaLiquidacionEstimada: '',
  toneladasMinimas: 0,
  tieneSeguroGranizo: false,
  tieneSeguroParametrico: false,
  tieneAvalSgr: false,
  sobrecolateralPct: 0,
};

function cicloDefault(): string {
  const anio = new Date().getFullYear();
  return `${anio}/${String((anio + 1) % 100).padStart(2, '0')}`;
}

export function NuevaCampanaPage() {
  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState<FormState>(inicial);
  const [modalFirma, setModalFirma] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
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
  const promedioZonal = cultivoElegido ? promedioZonalTnHa[cultivoElegido.nombre] ?? 3.5 : 3.5;
  const excedeHistorico = form.rindeEstimadoTnHa > promedioZonal * 1.15;
  const toneladasOfrecidas =
    form.modo === 'porcentual' ? (produccionEstimadaTn * form.valorModo) / 100 : form.valorModo;

  const cultivoNombre = normalizarCultivo(cultivoElegido?.nombre);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const puedeAvanzar0 =
    form.campoId && form.cultivoId && form.cicloAgricola && form.hectareas > 0 &&
    form.fechaSiembra && form.fechaCosecha && form.rindeEstimadoTnHa > 0;
  const puedeAvanzar1 = !!form.modo && form.valorModo > 0;
  // Mínimo sugerido: 2/3 de lo ofrecido, entero, al menos 1.
  const minimasSugeridas = Math.max(1, Math.floor((toneladasOfrecidas * 2) / 3));
  const minimasEfectivas = form.toneladasMinimas > 0 ? form.toneladasMinimas : minimasSugeridas;

  // Reglas del programa: now < sale_end < settlement_date. Las espejamos acá
  // para que el error aparezca en el wizard y no como InvalidDates on-chain.
  const fondeoDesdeMs = form.fondeoDesde ? new Date(form.fondeoDesde).getTime() : NaN;
  const fondeoHastaMs = form.fondeoHasta ? new Date(form.fondeoHasta).getTime() : NaN;
  const liquidacionMs = form.fechaLiquidacionEstimada ? new Date(form.fechaLiquidacionEstimada).getTime() : NaN;
  const ventanaOk = !Number.isNaN(fondeoDesdeMs) && !Number.isNaN(fondeoHastaMs) && fondeoHastaMs > fondeoDesdeMs;
  const cierreFuturo = !Number.isNaN(fondeoHastaMs) && fondeoHastaMs > Date.now();
  const liquidacionOk = Number.isNaN(liquidacionMs) || liquidacionMs > fondeoHastaMs;
  const minimasOk = minimasEfectivas >= 1 && minimasEfectivas <= Math.floor(toneladasOfrecidas);
  const puedeAvanzar2 = form.precioReferenciaUsdTn > 0 && ventanaOk && cierreFuturo && liquidacionOk && minimasOk;

  /**
   * Demo en vivo: la venta cierra en 5 minutos y se puede liquidar al sexto.
   * Es lo mínimo que permite el programa (sale_end < settlement_date) y deja
   * tiempo para aprobar, invertir y cobrar la siembra antes del cierre.
   */
  const armarDemoEnVivo = () => {
    const ahora = Date.now();
    setForm((f) => ({
      ...f,
      fondeoDesde: aLocalInput(new Date(ahora)),
      fondeoHasta: aLocalInput(new Date(ahora + 5 * 60_000)),
      fechaLiquidacionEstimada: aLocalInput(new Date(ahora + 6 * 60_000)),
    }));
  };

  const crearMut = useMutation({
    mutationFn: async () => {
      const data = await tokenizadasApi.crear({
        campaniaNueva: {
          nombre: `${campoElegido?.nombre ?? 'Campaña'} · ${cultivoElegido?.nombre ?? ''} ${form.cicloAgricola}`,
          establecimientoId: form.campoId,
          cultivoId: form.cultivoId,
          cicloAgricola: form.cicloAgricola,
          hectareasAfectadas: form.hectareas,
          fechaSiembraEstimada: form.fechaSiembra,
          fechaCosechaEstimada: form.fechaCosecha,
          rindeEstimadoTnHa: form.rindeEstimadoTnHa,
        },
        modo: form.modo!,
        porcentaje: form.modo === 'porcentual' ? form.valorModo : undefined,
        toneladasFijas: form.modo === 'fijo' ? form.valorModo : undefined,
        fuentePrecio: form.fuentePrecio,
        precioReferenciaUsdTn: form.precioReferenciaUsdTn,
        descuentoPct: form.descuentoPct,
        precioDinamico: form.precioDinamico,
        precioPisoUsd: form.precioPisoUsd ?? undefined,
        fondeoDesde: aIso(form.fondeoDesde),
        fondeoHasta: aIso(form.fondeoHasta),
        fechaLiquidacionEstimada: form.fechaLiquidacionEstimada ? aIso(form.fechaLiquidacionEstimada) : undefined,
        toneladasMinimas: minimasEfectivas,
        tieneSeguroGranizo: form.tieneSeguroGranizo,
        tieneSeguroParametrico: form.tieneSeguroParametrico,
        tieneAvalSgr: form.tieneAvalSgr,
        sobrecolateralPct: form.sobrecolateralPct,
      } as any);
      return data;
    },
  });

  const enviarRevision = async (tokenizacionId: string) => {
    await tokenizadasApi.enviarARevision(tokenizacionId);
  };

  const handleEnviarARevision = () => setModalFirma(true);

  // Enviar a revisión NO es una transacción on-chain: es un cambio de estado
  // en la base. La publicación en Solana (create_campaign) la firma el backend
  // cuando el admin aprueba. Por eso acá no se registra ninguna signature.
  const confirmarEnvio = async () => {
    const t = await crearMut.mutateAsync();
    await enviarRevision(t.id);
    qc.invalidateQueries({ queryKey: ['tk'] });
    toast.success('Emisión enviada a revisión', {
      description: 'Un admin la aprueba y recién ahí se publica en Solana.',
    });
    navigate('/campanas');
  };

  if (!conectada) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <h1 style={{ color: 'var(--hv-text)', fontSize: 24, fontWeight: 600 }}>Conectá tu wallet</h1>
      </div>
    );
  }

  const precioToken = form.precioReferenciaUsdTn * (1 - form.descuentoPct / 100);
  const totalUsd = precioToken * toneladasOfrecidas;

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/campanas" style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginBottom: 16, display: 'inline-flex', gap: 6, textDecoration: 'none' }}>
        ← Mis emisiones
      </Link>

      <div className="mb-6">
        <div className="hv-label" style={{ fontSize: 10 }}>Tokenizar lote · Solana devnet</div>
        <h1 style={{ color: 'var(--hv-text)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 6 }}>
          Nueva emisión HRV
        </h1>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 4 }}>
          Al finalizar firmás una transacción. Un admin revisa antes de publicarla al marketplace.
        </p>
      </div>

      <div className="mb-8">
        <WizardSteps pasos={PASOS} actual={paso} />
      </div>

      {/* Paso 1: La campaña */}
      {paso === 0 && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Lote">
              {campos.length === 0 ? (
                <div style={{ padding: 14, border: '1px dashed var(--hv-border)', borderRadius: 10, color: 'var(--hv-text-muted)', fontSize: 13 }}>
                  Sin lotes cargados.{' '}
                  <Link to="/campos/nuevo" style={{ color: 'var(--hv-green-text)', textDecoration: 'underline' }}>
                    Cargar uno
                  </Link>
                </div>
              ) : (
                <Select value={form.campoId} onChange={(v) => upd('campoId', v)}>
                  <option value="">Elegí un lote</option>
                  {campos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} — {hectareas(Number(c.superficieTotalHa ?? 0))}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Cultivo">
              <Select value={form.cultivoId} onChange={(v) => upd('cultivoId', v)}>
                <option value="">Elegí un cultivo</option>
                {cultivos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ciclo agrícola">
              <TextInput value={form.cicloAgricola} onChange={(v) => upd('cicloAgricola', v)} placeholder="2026/27" />
            </Field>
            <Field label="Hectáreas afectadas">
              <NumberInput
                value={form.hectareas}
                onChange={(v) => upd('hectareas', v)}
                unit="ha"
                max={campoElegido ? Number(campoElegido.superficieTotalHa ?? 999999) : undefined}
              />
              {campoElegido && (
                <p className="hv-label-sm" style={{ fontSize: 10, marginTop: 6 }}>
                  Superficie del lote: {hectareas(Number(campoElegido.superficieTotalHa ?? 0))}
                </p>
              )}
            </Field>
            <Field label="Fecha siembra estimada">
              <TextInput type="date" value={form.fechaSiembra} onChange={(v) => upd('fechaSiembra', v)} />
            </Field>
            <Field label="Fecha cosecha estimada">
              <TextInput type="date" value={form.fechaCosecha} onChange={(v) => upd('fechaCosecha', v)} />
            </Field>
            <Field label="Rinde estimado" className="md:col-span-2">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={Math.max(15, promedioZonal * 1.5)}
                  step={0.1}
                  value={form.rindeEstimadoTnHa}
                  onChange={(e) => upd('rindeEstimadoTnHa', Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--hv-green)' }}
                />
                <NumberInput
                  value={form.rindeEstimadoTnHa}
                  onChange={(v) => upd('rindeEstimadoTnHa', v)}
                  unit="tn/ha"
                  step={0.1}
                  width={128}
                />
              </div>
              <div className="flex justify-between mt-2" style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--hv-text-muted)' }}>
                  Promedio zonal:{' '}
                  <span className="hv-mono" style={{ color: 'var(--hv-text-2)' }}>{promedioZonal.toFixed(1)} tn/ha</span>
                </span>
                {excedeHistorico && (
                  <span className="hv-mono" style={{ color: 'var(--hv-amber-text)', fontWeight: 600 }}>
                    ⚠ 15% por encima del promedio
                  </span>
                )}
              </div>
            </Field>
          </div>

          {/* Producción estimada */}
          <div
            style={{
              borderRadius: 16,
              padding: 24,
              background: 'linear-gradient(180deg, rgba(43,224,106,0.10) 0%, rgba(43,224,106,0.02) 100%)',
              border: '1px solid rgba(43,224,106,0.28)',
              boxShadow: 'var(--hv-inset-top)',
            }}
            className="flex items-center justify-between"
          >
            <div>
              <div className="hv-label" style={{ fontSize: 10, color: 'var(--hv-green-text)' }}>
                Producción estimada
              </div>
              <div
                className="hv-mono"
                style={{ fontSize: 34, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.025em', marginTop: 4 }}
              >
                {toneladas(produccionEstimadaTn, 0)}
              </div>
              <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 4 }}>
                {form.hectareas > 0 && form.rindeEstimadoTnHa > 0
                  ? `${form.hectareas} ha × ${form.rindeEstimadoTnHa} tn/ha`
                  : 'Cargá hectáreas y rinde'}
              </div>
            </div>
            <div style={{ fontSize: 48, opacity: 0.25 }}>🌾</div>
          </div>
        </section>
      )}

      {/* Paso 2 */}
      {paso === 1 && (
        <section>
          <div className="mb-5">
            <h2 style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 18 }}>¿Cómo tokenizás?</h2>
            <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 4 }}>
              Elegí el modo y movele el slider de rinde real para ver el impacto en vivo.
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

      {/* Paso 3 */}
      {paso === 2 && (
        <section>
          <div className="mb-5">
            <h2 style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 18 }}>Cotización</h2>
            <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 4 }}>
              Fuente de precio, descuento y ventana de fondeo. La tasa implícita se calcula sola.
            </p>
          </div>
          <CalculadoraCotizacion
            cultivo={cultivoNombre}
            fuentePrecio={form.fuentePrecio}
            precioReferenciaUsdTn={form.precioReferenciaUsdTn}
            descuentoPct={form.descuentoPct}
            toneladasOfrecidas={toneladasOfrecidas}
            precioDinamico={form.precioDinamico}
            precioPisoUsd={form.precioPisoUsd}
            fondeoDesde={form.fondeoDesde}
            fondeoHasta={form.fondeoHasta}
            onFuenteCambia={(f) => upd('fuentePrecio', f)}
            onPrecioReferenciaCambia={(v) => upd('precioReferenciaUsdTn', v)}
            onDescuentoCambia={(v) => upd('descuentoPct', v)}
            onPrecioDinamicoCambia={(v) => upd('precioDinamico', v)}
            onPrecioPisoCambia={(v) => upd('precioPisoUsd', v)}
            onFondeoDesdeCambia={(v) => upd('fondeoDesde', v)}
            onFondeoHastaCambia={(v) => upd('fondeoHasta', v)}
          />

          {/* Liquidación y mínimo: los dos parámetros que el programa fija al crear la campaña */}
          <div className="hv-glass mt-4" style={{ borderRadius: 16, padding: 20 }}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 15 }}>Liquidación y mínimo</h3>
                <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 4, maxWidth: 520 }}>
                  Quedan escritos en el contrato al publicar. La liquidación tiene que ser después del cierre
                  del fondeo, y el mínimo es lo que tiene que venderse para que puedas cobrar la siembra.
                </p>
              </div>
              <button
                type="button"
                onClick={armarDemoEnVivo}
                className="hv-cta-ghost"
                style={{ padding: '8px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
                title="Fondeo cierra en 5 minutos y se liquida al sexto"
              >
                ⚡ Demo en vivo (5 + 1 min)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Fecha de liquidación (después del cierre del fondeo)">
                <input
                  type="datetime-local"
                  value={form.fechaLiquidacionEstimada}
                  min={form.fondeoHasta || undefined}
                  onChange={(e) => upd('fechaLiquidacionEstimada', e.target.value)}
                  style={{
                    background: 'var(--hv-bg-input)',
                    border: `1px solid ${liquidacionOk ? 'var(--hv-border)' : 'var(--hv-red-strong)'}`,
                    color: 'var(--hv-text)',
                    fontSize: 14,
                    padding: '9px 12px',
                    borderRadius: 8,
                    width: '100%',
                  }}
                />
                <div style={{ color: 'var(--hv-text-muted)', fontSize: 11, marginTop: 6 }}>
                  {!liquidacionOk
                    ? 'Tiene que ser posterior al cierre del fondeo.'
                    : form.fechaLiquidacionEstimada
                    ? 'El acopio recién puede liquidar a partir de esta fecha.'
                    : 'Vacío: se usa el cierre del fondeo + 90 días.'}
                </div>
              </Field>
              <Field label={`Mínimo de toneladas para cobrar (de ${Math.floor(toneladasOfrecidas)} ofrecidas)`}>
                <NumberInput
                  value={minimasEfectivas}
                  onChange={(v) => upd('toneladasMinimas', v)}
                  unit="tn"
                  max={Math.floor(toneladasOfrecidas)}
                />
                <div style={{ color: minimasOk ? 'var(--hv-text-muted)' : 'var(--hv-red-text)', fontSize: 11, marginTop: 6 }}>
                  {minimasOk
                    ? `Sugerido: ${minimasSugeridas} tn (dos tercios). Si el fondeo cierra por debajo, no se liberan fondos.`
                    : `Entre 1 y ${Math.floor(toneladasOfrecidas)} toneladas.`}
                </div>
              </Field>
            </div>
            {!cierreFuturo && form.fondeoHasta && (
              <p style={{ color: 'var(--hv-red-text)', fontSize: 12, marginTop: 12 }}>
                El cierre del fondeo ya pasó. El contrato exige que sea futuro al momento de publicar.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Paso 4 */}
      {paso === 3 && (
        <section>
          <div className="mb-5">
            <h2 style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 18 }}>Garantías + revisión final</h2>
            <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 4 }}>
              Cada garantía sube el score que ve el inversor y acelera fondeo.
            </p>
          </div>
          <PasoGarantias
            tieneSeguroGranizo={form.tieneSeguroGranizo}
            tieneSeguroParametrico={form.tieneSeguroParametrico}
            tieneAvalSgr={form.tieneAvalSgr}
            sobrecolateralPct={form.sobrecolateralPct}
            onCambia={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />

          {/* Resumen final antes del envío */}
          <div className="hv-glass mt-6" style={{ borderRadius: 16, padding: 20 }}>
            <div className="hv-label" style={{ fontSize: 10, marginBottom: 12 }}>Vista previa</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricaVista label="HRV a emitir" valor={toneladas(toneladasOfrecidas, 0)} />
              <MetricaVista label="Precio HRV" valor={usd(precioToken, 2)} />
              <MetricaVista label="Recaudación" valor={usdCompacto(totalUsd)} accent />
              <MetricaVista label="Cierre fondeo" valor={form.fondeoHasta ? new Date(form.fondeoHasta).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'} />
              <MetricaVista label="Liquidación" valor={form.fechaLiquidacionEstimada ? new Date(form.fechaLiquidacionEstimada).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'cierre + 90 días'} />
              <MetricaVista label="Mínimo" valor={toneladas(minimasEfectivas, 0)} />
            </div>
          </div>
        </section>
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between pt-6" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <button
          onClick={() => (paso === 0 ? navigate('/campanas') : setPaso(paso - 1))}
          style={{ background: 'transparent', border: 'none', color: 'var(--hv-text-muted)', fontSize: 13, cursor: 'pointer', padding: '10px 14px' }}
        >
          {paso === 0 ? 'Cancelar' : '← Atrás'}
        </button>
        <div className="flex items-center gap-3">
          {paso < PASOS.length - 1 ? (
            <button
              onClick={() => setPaso(paso + 1)}
              disabled={
                (paso === 0 && !puedeAvanzar0) ||
                (paso === 1 && !puedeAvanzar1) ||
                (paso === 2 && !puedeAvanzar2)
              }
              className="hv-cta"
            >
              Continuar →
            </button>
          ) : (
            <button onClick={handleEnviarARevision} className="hv-cta" disabled={crearMut.isPending}>
              {crearMut.isPending ? 'Firmando...' : 'Enviar a revisión'}
            </button>
          )}
        </div>
      </div>

      <FirmaTxModal
        open={modalFirma}
        detalle={{
          titulo: 'Enviar emisión a revisión',
          descripcion: 'Un admin la revisa. Cuando la aprueba, se publica en Solana y aparece en el marketplace.',
          onChain: false,
          items: [
            { label: 'Cultivo', value: cultivoElegido?.nombre ?? '' },
            { label: 'Ciclo', value: form.cicloAgricola },
            { label: 'HRV a emitir', value: toneladas(toneladasOfrecidas, 0) },
            { label: 'Precio HRV', value: usd(precioToken, 2) },
            { label: 'Recaudación potencial', value: usdCompacto(totalUsd) },
          ],
        }}
        onAprobar={confirmarEnvio}
        onCerrar={() => setModalFirma(false)}
      />
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="hv-label" style={{ fontSize: 10, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        background: 'var(--hv-bg-input)',
        border: '1px solid var(--hv-border)',
        color: 'var(--hv-text)',
        fontSize: 14,
        padding: '10px 14px',
        borderRadius: 10,
      }}
    >
      {children}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date';
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: 'var(--hv-bg-input)',
        border: '1px solid var(--hv-border)',
        color: 'var(--hv-text)',
        fontSize: 14,
        padding: '10px 14px',
        borderRadius: 10,
      }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  unit,
  max,
  step = 1,
  width,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  max?: number;
  step?: number;
  width?: number;
}) {
  return (
    <div style={{ position: 'relative', width: width ?? '100%' }}>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        min={0}
        max={max}
        step={step}
        className="hv-mono"
        style={{
          width: '100%',
          background: 'var(--hv-bg-input)',
          border: '1px solid var(--hv-border)',
          color: 'var(--hv-text)',
          fontSize: 14,
          padding: '10px 46px 10px 14px',
          borderRadius: 10,
          textAlign: 'right',
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: 'var(--hv-font-mono)',
          fontSize: 10,
          color: 'var(--hv-text-dim)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {unit}
      </span>
    </div>
  );
}

function MetricaVista({ label, valor, accent }: { label: string; valor: string; accent?: boolean }) {
  return (
    <div>
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div
        className="hv-mono"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: accent ? 'var(--hv-green-text)' : 'var(--hv-text)',
          letterSpacing: '-0.01em',
          marginTop: 4,
        }}
      >
        {valor}
      </div>
    </div>
  );
}
