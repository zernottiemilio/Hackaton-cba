import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Tokenizacion, DesgloseComision } from '../../types/tokenizadas';
import { usd, usdCompacto, toneladas, abreviarTx, porcentaje } from '../../utils/format';
import { explorerTxUrl } from '../../utils/explorer';
import { useWalletStore } from '../../stores/walletStore';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { useComisionConfig } from '../../hooks/useComisionConfig';

interface Props {
  open: boolean;
  tokenizacion: Tokenizacion;
  cantidad: number;
  disponibles: number;
  onClose: () => void;
}

type Paso = 'cantidad' | 'confirmacion' | 'listo';

/**
 * SheetCompra — flujo de 3 pasos según §8.3 del hackaton.md.
 *  1. Cantidad → dispara reserva (TTL 10 min con countdown visible)
 *  2. Confirmación → checkbox de comprensión de riesgo + firmar tx
 *  3. Listo → comprobante con tx hash
 */
export function SheetCompra({ open, tokenizacion: t, cantidad: cantidadInicial, disponibles, onClose }: Props) {
  const [paso, setPaso] = useState<Paso>('cantidad');
  const [cantidad, setCantidad] = useState(cantidadInicial);
  const [comprendoRiesgo, setComprendoRiesgo] = useState(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [expiraEn, setExpiraEn] = useState<number | null>(null);
  const [tenenciaId, setTenenciaId] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [comision, setComision] = useState<DesgloseComision | null>(null);
  const comisionCfg = useComisionConfig();
  const [firmando, setFirmando] = useState(false);

  const conectada = useWalletStore((s) => s.conectada);
  const registrarTx = useWalletStore((s) => s.registrarTx);
  const qc = useQueryClient();

  const total = cantidad * t.precioTokenUsd;
  const pctProduccion = t.tokensEmitidos > 0 ? (cantidad / t.tokensEmitidos) * 100 : 0;

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setPaso('cantidad');
      setCantidad(cantidadInicial);
      setComprendoRiesgo(false);
      setReservaId(null);
      setExpiraEn(null);
      setTenenciaId(null);
      setTxSignature(null);
      setComision(null);
    }
  }, [open, cantidadInicial]);

  const reservarMut = useMutation({
    mutationFn: async () => {
      if (!conectada) throw new Error('Conectá tu wallet');
      const r = await tokenizadasApi.reservar({
        tokenizacionId: t.id,
        cantidad,
        inversorWallet: conectada.address,
      });
      return r;
    },
    onSuccess: (r) => {
      setReservaId(r.reservaId);
      setExpiraEn(new Date(r.expiraEn).getTime());
      setPaso('confirmacion');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleConfirmar = async () => {
    if (!reservaId) return;
    setFirmando(true);
    try {
      // Simula "aprobando firma" con delay realista.
      await new Promise((r) => setTimeout(r, 600));
      const res = await tokenizadasApi.confirmarCompra(reservaId);
      setTxSignature(res.txSignature);
      setTenenciaId(res.tenenciaId);
      setComision(res.comision ?? null);
      registrarTx({
        signature: res.txSignature,
        tipo: 'comprar',
        descripcion: `${res.tokens} HRV de ${t.campania.establecimiento?.nombre}`,
        usdcMovido: -res.montoTotalUsdc,
        timestamp: Date.now(),
      });
      if (res.comision?.txComision) {
        registrarTx({
          signature: res.comision.txComision,
          tipo: 'fee',
          descripcion: `Fee ${porcentaje(res.comision.porcentaje, 1)} · compra en ${t.campania.establecimiento?.nombre ?? t.campania.nombre}`,
          usdcMovido: -res.comision.montoComisionUsd,
          timestamp: Date.now() + 1,
        });
      }
      qc.invalidateQueries({ queryKey: ['tk'] });
      setPaso('listo');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setFirmando(false);
    }
  };

  // z-index: el fondo va en 50 y el panel en 60. Con el mismo valor, Safari
  // pinta el panel (que anima transform) debajo del backdrop-filter del fondo.
  // Portal a <body>: el layout envuelve cada página en un motion.div que anima
  // `y` (transform), y eso convierte a ese div en el contenedor de todo
  // `position: fixed` que tenga adentro. Sin el portal, la sheet quedaba
  // anclada a la página, debajo del topbar y con el hero del mapa encima.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            // Sin backdrop-filter: en Safari el blur del fondo se aplicaba
            // también sobre el panel (sibling con transform) y la sheet se veía
            // borrosa y apagada. Un fondo opaco resuelve lo mismo sin el bug.
            style={{ background: 'rgba(0,0,0,0.78)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-[60] overflow-y-auto"
            style={{ background: 'var(--hv-bg-panel)', borderLeft: '1px solid var(--hv-border)' }}
          >
            {/* Header */}
            <div
              className="sticky top-0 flex items-center justify-between px-6 py-4"
              style={{ background: 'var(--hv-bg-panel)', borderBottom: '1px solid var(--hv-border-subtle)', zIndex: 10 }}
            >
              <div>
                <div className="hv-label-sm" style={{ fontSize: 10 }}>
                  Compra HRV · Solana devnet
                </div>
                <div style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, marginTop: 3 }}>
                  {t.campania.establecimiento?.nombre ?? t.campania.nombre}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--hv-text-muted)',
                  cursor: 'pointer',
                  padding: 8,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Steps indicator */}
            <div className="px-6 py-3 flex gap-1" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
              {(['cantidad', 'confirmacion', 'listo'] as Paso[]).map((p) => {
                const activo = p === paso;
                const completo =
                  (paso === 'confirmacion' && p === 'cantidad') ||
                  (paso === 'listo' && p !== 'listo');
                return (
                  <div
                    key={p}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 999,
                      background: completo || activo ? 'var(--hv-green)' : 'rgba(255,255,255,0.08)',
                      transition: 'background 300ms ease',
                    }}
                  />
                );
              })}
            </div>

            {/* Contenido */}
            <div className="p-6">
              {paso === 'cantidad' && (
                <PasoCantidad
                  t={t}
                  cantidad={cantidad}
                  setCantidad={setCantidad}
                  disponibles={disponibles}
                  total={total}
                  pctProduccion={pctProduccion}
                  onSiguiente={() => reservarMut.mutate()}
                  procesando={reservarMut.isPending}
                />
              )}
              {paso === 'confirmacion' && (
                <PasoConfirmacion
                  t={t}
                  cantidad={cantidad}
                  total={total}
                  comisionPct={comisionCfg.porcentaje}
                  comisionUsd={comisionCfg.desglosar(total).comision}
                  comprendoRiesgo={comprendoRiesgo}
                  setComprendoRiesgo={setComprendoRiesgo}
                  expiraEn={expiraEn}
                  firmando={firmando}
                  onFirmar={handleConfirmar}
                  onCancelar={() => setPaso('cantidad')}
                />
              )}
              {paso === 'listo' && (
                <PasoListo
                  t={t}
                  cantidad={cantidad}
                  total={total}
                  tenenciaId={tenenciaId}
                  txSignature={txSignature}
                  comision={comision}
                  red={conectada?.network ?? 'mock'}
                  onCerrar={onClose}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function PasoCantidad({
  t,
  cantidad,
  setCantidad,
  disponibles,
  total,
  pctProduccion,
  onSiguiente,
  procesando,
}: {
  t: Tokenizacion;
  cantidad: number;
  setCantidad: (v: number) => void;
  disponibles: number;
  total: number;
  pctProduccion: number;
  onSiguiente: () => void;
  procesando: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Precio */}
      <div className="hv-glass" style={{ borderRadius: 14, padding: 18 }}>
        <div className="hv-label-sm" style={{ fontSize: 10 }}>Precio por HRV</div>
        <div className="hv-mono" style={{ fontSize: 32, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.025em', marginTop: 4 }}>
          {usd(t.precioTokenUsd, 2)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--hv-text-muted)', marginTop: 4 }}>
          <span className="hv-mono" style={{ color: 'var(--hv-green-text)' }}>
            {(-t.descuentoPct).toFixed(1)}%
          </span>{' '}
          vs pizarra ·{' '}
          <span className="hv-mono">{usd(t.precioReferenciaUsdTn, 2)}</span>
        </div>
      </div>

      {/* Cantidad */}
      <div>
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>Cantidad</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCantidad(Math.max(1, cantidad - 1))}
            style={btnStep}
          >−</button>
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(Math.min(disponibles, Math.max(1, Number(e.target.value) || 1)))}
            min={1}
            max={disponibles}
            className="hv-mono"
            style={{
              flex: 1,
              background: 'var(--hv-bg-input)',
              border: '1px solid var(--hv-border)',
              borderRadius: 10,
              padding: '12px',
              textAlign: 'center',
              color: 'var(--hv-text)',
              fontSize: 20,
              fontWeight: 600,
            }}
          />
          <button
            onClick={() => setCantidad(Math.min(disponibles, cantidad + 1))}
            style={btnStep}
          >＋</button>
        </div>
        <div className="flex justify-between items-center mt-2" style={{ fontSize: 11 }}>
          <span className="hv-label-sm" style={{ fontSize: 10 }}>HRV</span>
          <span className="hv-mono" style={{ color: 'var(--hv-text-muted)' }}>
            Disponibles: <span style={{ color: 'var(--hv-text-2)' }}>{toneladas(disponibles, 0)}</span>
          </span>
        </div>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {[10, 50, 100, disponibles].filter((v) => v > 0).map((v, i) => (
            <button
              key={i}
              onClick={() => setCantidad(v)}
              className="hv-mono"
              style={{
                padding: '7px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--hv-border-subtle)',
                color: 'var(--hv-text-muted)',
                fontSize: 11,
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
      <div style={{ background: 'rgba(43,224,106,0.06)', border: '1px solid rgba(43,224,106,0.22)', borderRadius: 14, padding: 18 }}>
        <div className="flex justify-between items-baseline mb-2">
          <span style={{ color: 'var(--hv-text-2)', fontSize: 13 }}>Total a pagar</span>
          <span className="hv-mono" style={{ color: 'var(--hv-text)', fontSize: 26, fontWeight: 600 }}>
            {usdCompacto(total)}
          </span>
        </div>
        <div className="flex justify-between" style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
          <span className="hv-mono">USDC · Solana</span>
          <span className="hv-mono">= {pctProduccion.toFixed(2)}% producción</span>
        </div>
      </div>

      <button
        onClick={onSiguiente}
        disabled={procesando || cantidad === 0 || cantidad > disponibles}
        className="hv-cta"
        style={{ width: '100%', padding: '14px' }}
      >
        {procesando ? 'Reservando...' : 'Continuar →'}
      </button>
      <p className="hv-label-sm" style={{ fontSize: 10, textAlign: 'center' }}>
        Vas a poder revisar antes de firmar
      </p>
    </div>
  );
}

function PasoConfirmacion({
  t,
  cantidad,
  total,
  comisionPct,
  comisionUsd,
  comprendoRiesgo,
  setComprendoRiesgo,
  expiraEn,
  firmando,
  onFirmar,
  onCancelar,
}: {
  t: Tokenizacion;
  cantidad: number;
  total: number;
  comisionPct: number;
  comisionUsd: number;
  comprendoRiesgo: boolean;
  setComprendoRiesgo: (v: boolean) => void;
  expiraEn: number | null;
  firmando: boolean;
  onFirmar: () => void;
  onCancelar: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const restante = expiraEn ? Math.max(0, expiraEn - now) : 0;
  const min = Math.floor(restante / 60_000);
  const sec = Math.floor((restante % 60_000) / 1000);
  const expirado = restante === 0 && expiraEn !== null;

  return (
    <div className="space-y-4">
      {/* Countdown grande */}
      <div
        style={{
          borderRadius: 14,
          padding: 16,
          background: expirado ? 'var(--hv-red-soft)' : 'var(--hv-amber-soft)',
          border: `1px solid ${expirado ? 'var(--hv-red-strong)' : 'var(--hv-amber-strong)'}`,
          textAlign: 'center',
        }}
      >
        <div className="hv-label" style={{ fontSize: 10, color: expirado ? 'var(--hv-red-text)' : 'var(--hv-amber-text)', marginBottom: 4 }}>
          {expirado ? 'Reserva expirada' : 'Reserva activa'}
        </div>
        <div className="hv-mono" style={{ fontSize: 28, fontWeight: 600, color: expirado ? 'var(--hv-red-text)' : 'var(--hv-amber-text)', letterSpacing: '-0.02em' }}>
          {expirado ? '—' : `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`}
        </div>
      </div>

      {/* Resumen */}
      <div className="hv-glass" style={{ borderRadius: 14, padding: 18 }}>
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 12 }}>Resumen</div>
        <div className="space-y-2">
          <FilaResumen label="Emisión" value={t.campania.establecimiento?.nombre ?? ''} />
          <FilaResumen label="Cultivo" value={t.campania.cultivo?.nombre ?? ''} />
          <FilaResumen label="Modo" value={t.modo === 'porcentual' ? `Porcentual (${t.porcentaje}%)` : 'Cantidad fija'} />
          <FilaResumen label="Cantidad" value={`${cantidad} HRV`} mono />
          <FilaResumen label="Precio HRV" value={usd(t.precioTokenUsd, 2)} mono />
          <FilaResumen label="Va al vault de la campaña" value={usd(total, 2)} mono />
          <FilaResumen label={`Fee (${porcentaje(comisionPct, 1)})`} value={`+ ${usd(comisionUsd, 2)}`} mono />
          <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
            <FilaResumen label="Total a debitar" value={usd(total + comisionUsd, 2)} destacado />
          </div>
        </div>
      </div>

      {/* Escenarios de retorno */}
      <div className="hv-glass" style={{ borderRadius: 14, padding: 18 }}>
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 10 }}>Escenarios de retorno</div>
        <div className="space-y-2 text-sm">
          <EscenarioRow
            label="Peor"
            precio={t.precioTokenUsd * 0.8}
            cantidad={cantidad}
            total={total}
          />
          <EscenarioRow
            label="Esperado"
            precio={t.precioReferenciaUsdTn}
            cantidad={cantidad}
            total={total}
            destacado
          />
          <EscenarioRow
            label="Mejor"
            precio={t.precioReferenciaUsdTn * 1.15}
            cantidad={cantidad}
            total={total}
          />
        </div>
      </div>

      {/* Checkbox riesgo */}
      <label
        style={{
          display: 'flex',
          gap: 12,
          padding: 14,
          background: 'var(--hv-bg-input)',
          border: `1px solid ${comprendoRiesgo ? 'rgba(43,224,106,0.35)' : 'var(--hv-border)'}`,
          borderRadius: 12,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={comprendoRiesgo}
          onChange={(e) => setComprendoRiesgo(e.target.checked)}
          style={{ marginTop: 3, accentColor: 'var(--hv-green)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--hv-text-2)', lineHeight: 1.55 }}>
          Comprendo que el HRV se liquida en función de la cosecha real del lote. Si el rinde cae o el precio
          del grano baja, puedo recibir menos USDC de lo que invertí.
        </span>
      </label>

      {/* Acciones */}
      <div className="flex gap-3">
        <button onClick={onCancelar} className="hv-cta-ghost" style={{ flex: 1 }}>
          Atrás
        </button>
        <button
          onClick={onFirmar}
          disabled={!comprendoRiesgo || firmando || expirado}
          className="hv-cta"
          style={{ flex: 2 }}
        >
          {firmando ? (
            <span className="inline-flex items-center gap-2">
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(6,18,10,0.3)',
                  borderTopColor: 'var(--hv-bg-token)',
                  animation: 'hv-spin 700ms linear infinite',
                }}
              />
              Firmando...
            </span>
          ) : (
            'Firmar y comprar'
          )}
        </button>
      </div>
    </div>
  );
}

function PasoListo({
  t,
  cantidad,
  total,
  tenenciaId,
  txSignature,
  comision,
  red,
  onCerrar,
}: {
  t: Tokenizacion;
  cantidad: number;
  total: number;
  tenenciaId: string | null;
  txSignature: string | null;
  comision: DesgloseComision | null;
  red: 'mainnet-beta' | 'devnet' | 'mock';
  onCerrar: () => void;
}) {
  const linkCompra = txSignature ? explorerTxUrl(txSignature, red) : null;
  const linkComision = comision?.txComision ? explorerTxUrl(comision.txComision, red) : null;
  return (
    <div className="space-y-5 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--hv-green-soft)',
          border: '2px solid var(--hv-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '20px auto 10px',
          boxShadow: '0 0 40px rgba(43,224,106,0.25)',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="var(--hv-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>

      <div>
        <h3 style={{ color: 'var(--hv-text)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {cantidad} HRV en tu wallet
        </h3>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 4 }}>
          Transferiste {usd(total, 2)} USDC al vault de {t.campania.establecimiento?.nombre}.
        </p>
      </div>

      <div className="hv-glass" style={{ borderRadius: 14, padding: 18, textAlign: 'left' }}>
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 10 }}>Comprobante</div>
        <div className="space-y-2">
          <FilaResumen label="Operación" value={tenenciaId ? tenenciaId.slice(0, 8) : '—'} mono />
          <FilaResumen label="Tx compra" value={txSignature ? abreviarTx(txSignature) : '—'} mono />
          {comision && (
            <>
              <FilaResumen
                label={`Fee (${porcentaje(comision.porcentaje, 1)})`}
                value={usd(comision.montoComisionUsd, 2)}
                mono
              />
              <FilaResumen
                label="Tx fee"
                value={comision.txComision ? abreviarTx(comision.txComision) : 'pendiente'}
                mono
              />
            </>
          )}
          <FilaResumen label="Red" value={red === 'mock' ? 'Simulación' : `Solana ${red}`} />
        </div>
        {(linkCompra || linkComision) && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--hv-border-subtle)', fontSize: 12 }}>
            {linkCompra && (
              <a href={linkCompra} target="_blank" rel="noreferrer" style={{ color: 'var(--hv-green-text)', fontWeight: 600, textDecoration: 'none' }}>
                Ver compra en Explorer ↗
              </a>
            )}
            {linkComision && (
              <a href={linkComision} target="_blank" rel="noreferrer" style={{ color: 'var(--hv-green-text)', fontWeight: 600, textDecoration: 'none' }}>
                Ver fee en Explorer ↗
              </a>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <a href="/portfolio" className="hv-cta" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
          Ver mi portfolio →
        </a>
        <button onClick={onCerrar} className="hv-cta-ghost" style={{ padding: '10px' }}>
          Seguir explorando
        </button>
      </div>
    </div>
  );
}

function FilaResumen({ label, value, mono, destacado }: { label: string; value: string; mono?: boolean; destacado?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span style={{ color: 'var(--hv-text-muted)', fontSize: 12 }}>{label}</span>
      <span
        className={mono ? 'hv-mono' : ''}
        style={{
          color: destacado ? 'var(--hv-green-text)' : 'var(--hv-text)',
          fontSize: destacado ? 17 : 13,
          fontWeight: destacado ? 600 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EscenarioRow({ label, precio, cantidad, total, destacado }: { label: string; precio: number; cantidad: number; total: number; destacado?: boolean }) {
  const cobras = precio * cantidad;
  const pl = cobras - total;
  const plPct = (pl / total) * 100;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <span
          style={{
            color: destacado ? 'var(--hv-text)' : 'var(--hv-text-muted)',
            fontSize: 12,
            fontWeight: destacado ? 600 : 500,
          }}
        >
          {label}
        </span>
        <span className="hv-label-sm hv-mono" style={{ fontSize: 10 }}>
          soja {precio.toFixed(0)} USD/t
        </span>
      </div>
      <span
        className="hv-mono"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: pl >= 0 ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
        }}
      >
        {pl >= 0 ? '+' : ''}{plPct.toFixed(1)}%
      </span>
    </div>
  );
}

const btnStep: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--hv-border)',
  color: 'var(--hv-text)',
  fontSize: 18,
  cursor: 'pointer',
  fontFamily: 'var(--hv-font-mono)',
  fontWeight: 600,
};
