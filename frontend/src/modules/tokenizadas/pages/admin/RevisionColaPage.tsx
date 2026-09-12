import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { BadgeModo } from '../../components/campana/BadgeModo';
import { EstadoCampanaBadge } from '../../components/campana/EstadoCampanaBadge';
import { usd, usdCompacto, toneladas, hectareas, fecha } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';
import { FirmaTxModal } from '../../components/wallet/FirmaTxModal';

/**
 * Cola de revisión para el rol admin_plataforma.
 * Lista todas las emisiones en_revision con datos para decidir.
 * Aprobar dispara publicación on-chain (mint + vault). Rechazar pide motivo.
 */
export function RevisionColaPage() {
  const contexto = useWalletStore((s) => s.contextoActivo);
  const registrarTx = useWalletStore((s) => s.registrarTx);
  const qc = useQueryClient();
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [modalFirma, setModalFirma] = useState(false);
  const [modoDecision, setModoDecision] = useState<'aprobar' | 'rechazar' | null>(null);

  const { data: cola = [], isLoading } = useQuery({
    queryKey: ['tk', 'admin', 'revision'],
    queryFn: () => tokenizadasApi.colaRevision(),
    enabled: contexto === 'admin_plataforma',
    refetchInterval: 8000,
  });

  const seleccionada = cola.find((t) => t.id === seleccionadaId) ?? cola[0];

  const revisarMut = useMutation({
    mutationFn: (payload: { id: string; decision: 'aprobar' | 'rechazar'; motivoRechazo?: string }) =>
      tokenizadasApi.revisar(payload.id, { decision: payload.decision, motivoRechazo: payload.motivoRechazo }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tk'] });
      registrarTx({
        signature: `SIG${Math.random().toString(36).slice(2, 10)}`,
        tipo: 'publicar',
        descripcion: `${vars.decision === 'aprobar' ? 'Aprobación' : 'Rechazo'} de emisión ${vars.id.slice(0, 8)}`,
        timestamp: Date.now(),
      });
      toast.success(vars.decision === 'aprobar' ? 'Emisión publicada al marketplace' : 'Emisión rechazada');
      setSeleccionadaId(null);
      setMotivoRechazo('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (contexto !== 'admin_plataforma') {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <h1 style={{ color: 'var(--hv-text)', fontSize: 22, fontWeight: 600 }}>Acceso restringido</h1>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6 }}>
          Necesitás el contexto Admin para acceder a la cola de revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="hv-label" style={{ fontSize: 10 }}>Cola de revisión · admin</div>
        <h1 style={{ color: 'var(--hv-text)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 6 }}>
          Emisiones esperando aprobación
        </h1>
        <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 4 }}>
          {cola.length} en cola · se actualiza cada 8 segundos
        </p>
      </div>

      {isLoading ? (
        <div className="hv-glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--hv-text-muted)' }}>
          Cargando cola...
        </div>
      ) : cola.length === 0 ? (
        <VacioCola />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
          {/* Lista */}
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
            {cola.map((t) => (
              <ItemCola
                key={t.id}
                t={t}
                activo={seleccionada?.id === t.id}
                onClick={() => setSeleccionadaId(t.id)}
              />
            ))}
          </div>

          {/* Detalle */}
          {seleccionada && (
            <DetalleRevision
              t={seleccionada}
              motivoRechazo={motivoRechazo}
              onMotivoCambia={setMotivoRechazo}
              onAprobar={() => {
                setModoDecision('aprobar');
                setModalFirma(true);
              }}
              onRechazar={() => {
                if (!motivoRechazo.trim() || motivoRechazo.length < 3) {
                  toast.error('Cargá un motivo de rechazo');
                  return;
                }
                revisarMut.mutate({ id: seleccionada.id, decision: 'rechazar', motivoRechazo });
              }}
              procesando={revisarMut.isPending}
            />
          )}
        </div>
      )}

      <FirmaTxModal
        open={modalFirma}
        detalle={{
          titulo: 'Publicar emisión al marketplace',
          descripcion: 'La emisión se hace pública. Crea Mint SPL + Vault PDA on-chain.',
          costoSol: 0.0425,
          items: seleccionada
            ? [
                { label: 'Lote', value: seleccionada.campania.establecimiento?.nombre ?? '' },
                { label: 'Cultivo', value: seleccionada.campania.cultivo?.nombre ?? '' },
                { label: 'HRV', value: toneladas(seleccionada.toneladasOfrecidas, 0) },
                { label: 'Precio', value: usd(seleccionada.precioTokenUsd, 2) },
              ]
            : [],
        }}
        onAprobar={async () => {
          if (!seleccionada || !modoDecision) return;
          await revisarMut.mutateAsync({ id: seleccionada.id, decision: modoDecision });
        }}
        onRechazar={() => {
          setModalFirma(false);
          setModoDecision(null);
        }}
      />
    </div>
  );
}

function ItemCola({
  t,
  activo,
  onClick,
}: {
  t: any;
  activo: boolean;
  onClick: () => void;
}) {
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
            {t.campania.cultivo?.nombre} · {t.campania.establecimiento?.partido}
          </div>
        </div>
        <BadgeModo modo={t.modo} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>HRV</div>
          <div className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)' }}>
            {toneladas(t.toneladasOfrecidas, 0)}
          </div>
        </div>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>Recaudación</div>
          <div className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-green-text)' }}>
            {usdCompacto(Number(t.montoObjetivoUsd))}
          </div>
        </div>
      </div>
    </button>
  );
}

function DetalleRevision({
  t,
  motivoRechazo,
  onMotivoCambia,
  onAprobar,
  onRechazar,
  procesando,
}: {
  t: any;
  motivoRechazo: string;
  onMotivoCambia: (v: string) => void;
  onAprobar: () => void;
  onRechazar: () => void;
  procesando: boolean;
}) {
  return (
    <div className="hv-glass" style={{ borderRadius: 16, padding: 24 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BadgeModo modo={t.modo} size="md" />
            <EstadoCampanaBadge estado={t.campania.estadoToken} />
          </div>
          <h2 style={{ color: 'var(--hv-text)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </h2>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 4 }}>
            {t.campania.cultivo?.nombre} · {hectareas(Number(t.campania.hectareasAfectadas ?? 0))} ·{' '}
            {t.campania.establecimiento?.partido}, {t.campania.establecimiento?.provincia}
          </p>
        </div>
      </div>

      {/* Productor */}
      <div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>Productor</div>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--hv-green-deep), var(--hv-green-mid))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--hv-bg-token)',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {t.productor?.nombre?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 600 }}>{t.productor?.nombre}</div>
            <div className="hv-mono" style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
              {t.productor?.email}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Metrica label="HRV a emitir" value={toneladas(t.toneladasOfrecidas, 0)} />
        <Metrica label="Precio HRV" value={usd(t.precioTokenUsd, 2)} accent />
        <Metrica label="Descuento" value={`${t.descuentoPct}%`} />
        <Metrica label="Recaudación" value={usdCompacto(Number(t.montoObjetivoUsd))} accent />
        <Metrica label="Rinde estimado" value={`${t.campania.rindeEstimadoTnHa} tn/ha`} />
        <Metrica label="Fondeo desde" value={t.fondeoDesde ? fecha(t.fondeoDesde) : '—'} />
        <Metrica label="Fondeo hasta" value={t.fondeoHasta ? fecha(t.fondeoHasta) : '—'} />
        <Metrica label="Cosecha estimada" value={t.campania.fechaCosechaEstimada ? fecha(t.campania.fechaCosechaEstimada) : '—'} />
      </div>

      {/* Garantías */}
      <div className="mb-6">
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>Garantías</div>
        <div className="flex flex-wrap gap-2">
          <GarantiaChip activa={t.tieneSeguroGranizo} label="Granizo" />
          <GarantiaChip activa={t.tieneSeguroParametrico} label="Paramétrico" />
          <GarantiaChip activa={t.tieneAvalSgr} label="Aval SGR" />
          <GarantiaChip activa={t.sobrecolateralPct > 0} label={`Sobrecolateral ${t.sobrecolateralPct}%`} />
        </div>
      </div>

      {/* Textarea rechazo */}
      <div className="mb-4">
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 6 }}>Motivo del rechazo (opcional)</div>
        <textarea
          value={motivoRechazo}
          onChange={(e) => onMotivoCambia(e.target.value)}
          placeholder="Ej: Rinde estimado muy por encima del histórico zonal..."
          rows={3}
          style={{
            width: '100%',
            background: 'var(--hv-bg-input)',
            border: '1px solid var(--hv-border)',
            color: 'var(--hv-text)',
            fontSize: 13,
            padding: '12px 14px',
            borderRadius: 10,
            resize: 'vertical',
            fontFamily: 'var(--hv-font-sans)',
          }}
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <button
          onClick={onRechazar}
          disabled={procesando}
          style={{
            padding: '11px 20px',
            borderRadius: 10,
            background: 'var(--hv-red-soft)',
            color: 'var(--hv-red-text)',
            border: '1px solid var(--hv-red-strong)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Rechazar
        </button>
        <button onClick={onAprobar} disabled={procesando} className="hv-cta">
          {procesando ? 'Firmando...' : 'Aprobar y publicar'}
        </button>
      </div>
    </div>
  );
}

function Metrica({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: 'var(--hv-bg-input)',
        border: '1px solid var(--hv-border-subtle)',
      }}
    >
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div
        className="hv-mono"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: accent ? 'var(--hv-green-text)' : 'var(--hv-text)',
          marginTop: 4,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function GarantiaChip({ activa, label }: { activa: boolean; label: string }) {
  return (
    <span
      className="hv-chip"
      style={{
        background: activa ? 'var(--hv-green-soft)' : 'rgba(255,255,255,0.02)',
        borderColor: activa ? 'rgba(43,224,106,0.28)' : 'var(--hv-border-subtle)',
        color: activa ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: activa ? 'var(--hv-green)' : 'var(--hv-text-muted)',
        }}
      />
      {label}
    </span>
  );
}

function VacioCola() {
  return (
    <div className="hv-glass" style={{ borderRadius: 20, padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 12 }}>✓</div>
      <h3 style={{ color: 'var(--hv-text)', fontSize: 18, fontWeight: 600 }}>Cola vacía</h3>
      <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6 }}>
        No hay emisiones esperando revisión. Se auto-actualiza cada 8 segundos.
      </p>
      <Link to="/invertir" style={{ color: 'var(--hv-green-text)', fontSize: 12, textDecoration: 'none', marginTop: 20, display: 'inline-block' }}>
        Ver marketplace →
      </Link>
    </div>
  );
}
