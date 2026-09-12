import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { BadgeModo } from '../../components/campana/BadgeModo';
import { EstadoCampanaBadge } from '../../components/campana/EstadoCampanaBadge';
import { FirmaTxModal } from '../../components/wallet/FirmaTxModal';
import { useWalletStore, useContextoActivo } from '../../stores/walletStore';
import { explorerTxUrl } from '../../utils/explorer';
import { usd, usdCompacto, usdTn, toneladas, fecha, diasRestantes, porcentaje, abreviarTx } from '../../utils/format';
import type { Tokenizacion } from '../../types/tokenizadas';

/**
 * Liquidación (settle) para admin_plataforma. Paso 5 de la demo.
 *
 * El admin carga cuántas toneladas entregó el productor y a qué precio las
 * pagó el acopio. Antes de confirmar ve en vivo cuánto entra al vault y
 * cuánto cobra cada token. Esto es lo que permite mostrar el escenario
 * sequía: entregar menos toneladas reparte la pérdida pro rata entre los
 * holders, sin que nadie quede afuera.
 */
export function LiquidacionPage() {
  const contexto = useContextoActivo();
  const registrarTx = useWalletStore((s) => s.registrarTx);
  const red = useWalletStore((s) => s.conectada?.network ?? 'mock');
  const qc = useQueryClient();
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [modalFirma, setModalFirma] = useState(false);
  const [form, setForm] = useState<{ entregadas: number; precio: number } | null>(null);

  const { data: cola = [], isLoading } = useQuery({
    queryKey: ['tk', 'admin', 'liquidacion'],
    queryFn: () => tokenizadasApi.colaLiquidacion(),
    enabled: contexto === 'admin_plataforma',
    refetchInterval: 8000,
  });

  const pendientes = cola.filter((t) => t.campania.estadoToken === 'fondeada');
  const historial = cola.filter((t) => t.campania.estadoToken === 'liquidada');
  const seleccionada = pendientes.find((t) => t.id === seleccionadaId) ?? pendientes[0];

  // Al cambiar de campaña, el form arranca en "cosecha completa a precio de referencia".
  useEffect(() => {
    if (!seleccionada) {
      setForm(null);
      return;
    }
    setForm({ entregadas: Number(seleccionada.tokensVendidos), precio: Number(seleccionada.precioReferenciaUsdTn) });
  }, [seleccionada?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const liquidarMut = useMutation({
    mutationFn: (vars: { id: string; entregadas: number; precio: number }) =>
      tokenizadasApi.liquidar(vars.id, { toneladasEntregadas: vars.entregadas, precioLiquidacionUsdTn: vars.precio }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['tk'] });
      registrarTx({
        signature: res.txSignature,
        tipo: 'liquidar',
        descripcion: `Liquidación ${vars.id.slice(0, 8)} · ${vars.entregadas} tn a ${usdTn(vars.precio)}`,
        usdcMovido: res.depositoUsd,
        timestamp: Date.now(),
      });
      const link = explorerTxUrl(res.txSignature, red);
      toast.success(`Liquidada: ${usd(res.payoutPorTokenUsd, 2)} por token`, {
        description: `${usd(res.depositoUsd, 2)} USDC entraron al vault. Los holders ya pueden cobrar.`,
        action: link ? { label: 'Ver tx', onClick: () => window.open(link, '_blank', 'noreferrer') } : undefined,
      });
      setSeleccionadaId(null);
    },
  });

  if (contexto !== 'admin_plataforma') {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <h1 style={{ color: 'var(--hv-text)', fontSize: 22, fontWeight: 600 }}>Acceso restringido</h1>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6 }}>
          Necesitás el rol Admin para liquidar campañas.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="hv-label" style={{ fontSize: 10 }}>Liquidación · admin actúa por el acopio</div>
        <h1 style={{ color: 'var(--hv-text)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 6 }}>
          Campañas para liquidar
        </h1>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 4 }}>
          {pendientes.length} pendientes · {historial.length} liquidadas · se actualiza cada 8 segundos
        </p>
      </div>

      {isLoading ? (
        <div className="hv-glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--hv-text-muted)' }}>
          Cargando…
        </div>
      ) : pendientes.length === 0 && historial.length === 0 ? (
        <Vacio />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
          <div className="space-y-2 lg:max-h-[calc(100vh-260px)] overflow-y-auto">
            {pendientes.map((t) => (
              <ItemCola key={t.id} t={t} activo={seleccionada?.id === t.id} onClick={() => setSeleccionadaId(t.id)} />
            ))}
            {historial.length > 0 && (
              <>
                <div className="hv-label-sm" style={{ fontSize: 10, padding: '12px 4px 4px' }}>Ya liquidadas</div>
                {historial.map((t) => (
                  <ItemHistorial key={t.id} t={t} red={red} />
                ))}
              </>
            )}
          </div>

          {seleccionada && form ? (
            <DetalleLiquidacion
              t={seleccionada}
              form={form}
              onForm={setForm}
              onLiquidar={() => setModalFirma(true)}
              procesando={liquidarMut.isPending}
            />
          ) : (
            <div className="hv-glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--hv-text-muted)' }}>
              No hay campañas fondeadas esperando liquidación.
            </div>
          )}
        </div>
      )}

      {seleccionada && form && (
        <FirmaTxModal
          open={modalFirma}
          detalle={{
            titulo: 'Liquidar la campaña',
            descripcion:
              'El acopio deposita en el vault lo que pagó por el grano entregado. El programa fija cuánto cobra cada token y los holders pueden redimir.',
            usdcAMover: form.entregadas * form.precio,
            items: [
              { label: 'Campaña', value: seleccionada.campania.establecimiento?.nombre ?? seleccionada.campania.nombre },
              { label: 'Toneladas entregadas', value: `${form.entregadas} de ${Number(seleccionada.tokensVendidos)} vendidas` },
              { label: 'Precio pagado', value: usdTn(form.precio) },
              { label: 'Entra al vault', value: `${usd(form.entregadas * form.precio, 2)} USDC` },
              { label: 'Cobra cada token', value: usd(calcularPayout(form.entregadas, form.precio, Number(seleccionada.tokensVendidos)), 2) },
            ],
          }}
          onAprobar={async () => {
            const res = await liquidarMut.mutateAsync({ id: seleccionada.id, entregadas: form.entregadas, precio: form.precio });
            return { txSignature: res.txSignature };
          }}
          onCerrar={() => setModalFirma(false)}
        />
      )}
    </div>
  );
}

/**
 * settlement_date efectiva. Espeja la regla del backend (`publicarCampana`):
 * la fecha que fijó el productor o, si no la fijó, fondeoHasta + 90 días.
 */
function fechaSettlement(t: Tokenizacion): Date {
  if (t.fechaLiquidacionEstimada) return new Date(t.fechaLiquidacionEstimada);
  return new Date(new Date(t.fondeoHasta).getTime() + 90 * 24 * 60 * 60 * 1000);
}

/** Mismo cálculo que el programa: deposit / tons_sold. El polvo de redondeo queda en el vault. */
function calcularPayout(entregadas: number, precio: number, vendidas: number): number {
  if (vendidas <= 0) return 0;
  const depositoMicro = Math.round(entregadas * precio * 1_000_000);
  return Math.floor(depositoMicro / vendidas) / 1_000_000;
}

function ItemCola({ t, activo, onClick }: { t: Tokenizacion; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: 16,
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: activo ? 'rgba(43,224,106,0.08)' : 'var(--hv-bg-panel)',
        border: `1px solid ${activo ? 'rgba(43,224,106,0.35)' : 'var(--hv-border)'}`,
        boxShadow: activo ? '0 0 24px rgba(43,224,106,0.12)' : 'var(--hv-inset-top)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 14 }}>
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </div>
          <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 3 }}>
            {t.campania.cultivo?.nombre} · {t.productor?.nombre}
          </div>
        </div>
        <BadgeModo modo={t.modo} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>Vendidas</div>
          <div className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)' }}>
            {toneladas(Number(t.tokensVendidos), 0)}
          </div>
        </div>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>Liquida</div>
          <div className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)' }}>
            {diasRestantes(fechaSettlement(t))}
          </div>
        </div>
      </div>
    </button>
  );
}

function ItemHistorial({ t, red }: { t: Tokenizacion; red: 'mainnet-beta' | 'devnet' | 'mock' }) {
  const link = t.txSignatureLiquidacion ? explorerTxUrl(t.txSignatureLiquidacion, red) : null;
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'var(--hv-bg-panel)',
        border: '1px solid var(--hv-border-subtle)',
        opacity: 0.85,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 13 }}>
          {t.campania.establecimiento?.nombre ?? t.campania.nombre}
        </div>
        {t.campania.estadoToken && <EstadoCampanaBadge estado={t.campania.estadoToken} />}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="hv-label-sm" style={{ fontSize: 10 }}>
          {t.toneladasEntregadas != null ? `${toneladas(Number(t.toneladasEntregadas), 0)} entregadas` : ''}
          {t.precioLiquidacionUsdTn != null ? ` · ${usdTn(Number(t.precioLiquidacionUsdTn))}` : ''}
        </span>
        <span className="hv-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--hv-green-text)' }}>
          {t.payoutPorTokenUsd != null ? `${usd(Number(t.payoutPorTokenUsd), 2)}/token` : ''}
        </span>
      </div>
      {t.txSignatureLiquidacion && (
        <div className="mt-1.5">
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="hv-mono" style={{ fontSize: 10, color: 'var(--hv-green-text)', textDecoration: 'none' }}>
              {abreviarTx(t.txSignatureLiquidacion)} ↗
            </a>
          ) : (
            <span className="hv-mono" style={{ fontSize: 10, color: 'var(--hv-text-muted)' }}>{abreviarTx(t.txSignatureLiquidacion)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function DetalleLiquidacion({
  t,
  form,
  onForm,
  onLiquidar,
  procesando,
}: {
  t: Tokenizacion;
  form: { entregadas: number; precio: number };
  onForm: (f: { entregadas: number; precio: number }) => void;
  onLiquidar: () => void;
  procesando: boolean;
}) {
  const vendidas = Number(t.tokensVendidos);
  const precioToken = Number(t.precioTokenUsd);
  const referencia = Number(t.precioReferenciaUsdTn);
  const invertido = vendidas * precioToken;

  // Countdown vivo: en la demo settlementDate es now + 60s, hay que ver pasar el reloj.
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const fechaLiq = fechaSettlement(t).getTime();
  const todaviaNo = fechaLiq > ahora;
  const segundosFaltan = Math.max(0, Math.ceil((fechaLiq - ahora) / 1000));
  const cuentaRegresiva = `${Math.floor(segundosFaltan / 60)}:${String(segundosFaltan % 60).padStart(2, '0')}`;

  const entregadasOk = form.entregadas >= 1 && form.entregadas <= vendidas && Number.isInteger(form.entregadas);
  const precioOk = form.precio > 0;

  const deposito = form.entregadas * form.precio;
  const payout = calcularPayout(form.entregadas, form.precio, vendidas);
  const retornoPct = precioToken > 0 ? (payout / precioToken - 1) * 100 : 0;
  const totalHolders = payout * vendidas;

  const escenarios = useMemo(
    () => [
      { label: 'Cosecha completa', desc: 'Entrega todo a precio de referencia', entregadas: vendidas, precio: referencia },
      { label: 'Precio subió', desc: '+24% sobre referencia', entregadas: vendidas, precio: Math.round(referencia * 1.24 * 100) / 100 },
      { label: 'Sequía', desc: 'Entrega el 83% de lo vendido', entregadas: Math.max(1, Math.floor(vendidas * 0.83)), precio: Math.round(referencia * 1.24 * 100) / 100 },
    ],
    [vendidas, referencia],
  );

  return (
    <div className="hv-glass" style={{ borderRadius: 16, padding: 24 }}>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BadgeModo modo={t.modo} size="md" />
            {t.campania.estadoToken && <EstadoCampanaBadge estado={t.campania.estadoToken} />}
          </div>
          <h2 style={{ color: 'var(--hv-text)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </h2>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 4 }}>
            {t.campania.cultivo?.nombre} · {t.campania.cicloAgricola} · productor {t.productor?.nombre}
          </p>
        </div>
        <Link to={`/invertir/${t.id}`} style={{ color: 'var(--hv-green-text)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
          Ver ficha →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Metrica label="Vendidas" value={toneladas(vendidas, 0)} />
        <Metrica label="Precio del token" value={usd(precioToken, 2)} />
        <Metrica label="Los inversores pusieron" value={usdCompacto(invertido)} />
        <Metrica label="Fecha de liquidación" value={fecha(fechaSettlement(t))} />
      </div>

      <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>Escenarios rápidos</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
        {escenarios.map((e) => {
          const activo = e.entregadas === form.entregadas && e.precio === form.precio;
          return (
            <button
              key={e.label}
              onClick={() => onForm({ entregadas: e.entregadas, precio: e.precio })}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                background: activo ? 'rgba(43,224,106,0.08)' : 'var(--hv-bg-input)',
                border: `1px solid ${activo ? 'rgba(43,224,106,0.35)' : 'var(--hv-border-subtle)'}`,
              }}
            >
              <div style={{ color: 'var(--hv-text)', fontSize: 13, fontWeight: 600 }}>{e.label}</div>
              <div style={{ color: 'var(--hv-text-muted)', fontSize: 11, marginTop: 2 }}>{e.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Campo label={`Toneladas entregadas (máx. ${vendidas})`}>
          <input
            type="number"
            min={1}
            max={vendidas}
            step={1}
            value={form.entregadas}
            onChange={(e) => onForm({ ...form, entregadas: Number(e.target.value) })}
           
            style={inputStyle(entregadasOk)}
          />
        </Campo>
        <Campo label="Precio pagado por el acopio (USD/tn)">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.precio}
            onChange={(e) => onForm({ ...form, precio: Number(e.target.value) })}
           
            style={inputStyle(precioOk)}
          />
        </Campo>
      </div>

      {/* Resultado en vivo: el número que el jurado tiene que ver */}
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          background: 'var(--hv-bg-input)',
          border: '1px solid var(--hv-border-subtle)',
          marginBottom: 20,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="hv-label-sm" style={{ fontSize: 9 }}>Entra al vault</div>
            <div className="hv-mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em', marginTop: 4 }}>
              {usd(deposito, 2)}
            </div>
            <div style={{ color: 'var(--hv-text-muted)', fontSize: 11, marginTop: 2 }}>
              {form.entregadas} tn × {usdTn(form.precio)}
            </div>
          </div>
          <div>
            <div className="hv-label-sm" style={{ fontSize: 9 }}>Cobra cada token</div>
            <div className="hv-mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-green-text)', letterSpacing: '-0.02em', marginTop: 4 }}>
              {usd(payout, 2)}
            </div>
            <div style={{ color: 'var(--hv-text-muted)', fontSize: 11, marginTop: 2 }}>
              {usd(deposito, 0)} ÷ {vendidas} tokens
            </div>
          </div>
          <div>
            <div className="hv-label-sm" style={{ fontSize: 9 }}>Retorno del inversor</div>
            <div
              className="hv-mono"
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: retornoPct >= 0 ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
                letterSpacing: '-0.02em',
                marginTop: 4,
              }}
            >
              {porcentaje(retornoPct, 1)}
            </div>
            <div style={{ color: 'var(--hv-text-muted)', fontSize: 11, marginTop: 2 }}>
              cobra {usdCompacto(totalHolders)} sobre {usdCompacto(invertido)}
            </div>
          </div>
        </div>
        {form.entregadas < vendidas && entregadasOk && (
          <p style={{ color: 'var(--hv-amber-text)', fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
            Se entregaron {vendidas - form.entregadas} tn menos de las vendidas. El programa reparte lo que entró
            entre los {vendidas} tokens: nadie cobra de más, nadie queda afuera. Ese es el modelo de participación.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <button onClick={onLiquidar} disabled={procesando || todaviaNo || !entregadasOk || !precioOk} className="hv-cta">
          {procesando ? 'Firmando...' : todaviaNo ? `Liquidar en ${cuentaRegresiva}` : 'Liquidar campaña'}
        </button>
        <span style={{ color: 'var(--hv-text-muted)', fontSize: 11 }}>
          {todaviaNo
            ? `El programa rechaza settle antes de ${fecha(fechaSettlement(t))}. El reloj corre on-chain, no acá.`
            : !entregadasOk
            ? `Las toneladas entregadas van de 1 a ${vendidas}, enteras.`
            : !precioOk
            ? 'El precio tiene que ser mayor a cero.'
            : 'Firma el fee-payer de la plataforma en nombre del acopio.'}
        </span>
      </div>
    </div>
  );
}

function inputStyle(ok: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: 'var(--hv-bg-input)',
    border: `1px solid ${ok ? 'var(--hv-border)' : 'var(--hv-red-strong)'}`,
    color: 'var(--hv-text)',
    fontSize: 15,
    fontFamily: 'var(--hv-font-mono)',
    padding: '11px 14px',
    borderRadius: 10,
  };
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="hv-label" style={{ fontSize: 10, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Metrica({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, background: 'var(--hv-bg-input)', border: '1px solid var(--hv-border-subtle)' }}>
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div className="hv-mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--hv-text)', marginTop: 4, letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  );
}

function Vacio() {
  return (
    <div className="hv-glass" style={{ borderRadius: 20, padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 12 }}>◎</div>
      <h3 style={{ color: 'var(--hv-text)', fontSize: 18, fontWeight: 600 }}>Nada para liquidar</h3>
      <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6 }}>
        Cuando un productor cobre la siembra, la campaña pasa a fondeada y aparece acá.
      </p>
      <Link to="/revision-emisiones" style={{ color: 'var(--hv-green-text)', fontSize: 12, textDecoration: 'none', marginTop: 20, display: 'inline-block' }}>
        Ir a la cola de revisión →
      </Link>
    </div>
  );
}
