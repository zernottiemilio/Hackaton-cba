import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarClock, Loader2, MapPin, Package, ShieldCheck, TrendingUp, Wheat,
} from 'lucide-react';
import { tokenizadasService } from '@/services/tokenizadasService';
import { useAuthStore } from '@/stores/authStore';
import { SheetCompra } from '@/components/marketplace/SheetCompra';

const FMT_USD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const FMT_USD_INT = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FMT_PCT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const FMT_FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

export function FichaEmisionPage() {
  const { id } = useParams<{ id: string }>();
  const usuario = useAuthStore((s) => s.usuario);

  const { data, isLoading, error } = useQuery({
    queryKey: ['marketplace-detalle', id],
    queryFn: () => tokenizadasService.detalleMarketplace(id!),
    enabled: !!id,
  });

  // Simulador de retorno — inversor mueve toneladas + precio final esperado
  const [tonelasSimuladas, setToneladasSimuladas] = useState(1);
  const [precioFinalEsperado, setPrecioFinalEsperado] = useState<number | null>(null);
  const [sheetCompraOpen, setSheetCompraOpen] = useState(false);

  const simulacion = useMemo(() => {
    if (!data) return null;
    const precioToken = Number(data.precioTokenUsd);
    const inversion = tonelasSimuladas * precioToken;
    const precioLiquidacion = precioFinalEsperado ?? precioToken;
    const retornoPorTn = precioLiquidacion - precioToken;
    const retornoTotal = retornoPorTn * tonelasSimuladas;
    const retornoPct = precioToken > 0 ? (retornoPorTn / precioToken) * 100 : 0;
    return { inversion, retornoPorTn, retornoTotal, retornoPct, precioLiquidacion };
  }, [data, tonelasSimuladas, precioFinalEsperado]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No pudimos cargar esta emisión.
        </div>
      </div>
    );
  }

  const cultivo = data.campania.cultivo?.nombre ?? '—';
  const establecimiento = data.campania.establecimiento;
  const ubic = [establecimiento?.localidad, establecimiento?.provincia].filter(Boolean).join(', ');
  const precioToken = Number(data.precioTokenUsd);
  const descuento = Number(data.descuentoPct);
  const cierre = new Date(data.fondeoHasta);
  const hectareas = Number(data.campania.hectareasAfectadas);
  const rindeEstimado = Number(data.campania.rindeEstimadoTnHa);
  const produccionEstimadaTn = hectareas * rindeEstimado;
  const conGarantias = data.tieneSeguroGranizo || data.tieneSeguroParametrico || data.tieneAvalSgr;
  const puedeComprar = usuario?.rolPlataforma === 'inversor';

  return (
    <div className="space-y-6">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Marketplace
      </Link>

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.campania.nombre}</p>
          <h1 className="text-2xl font-semibold">{establecimiento?.nombre ?? 'Campo'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Productor: <span className="font-medium text-foreground">{data.productor.nombre}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Precio del token</p>
          <p className="text-3xl font-semibold">{FMT_USD.format(precioToken)}/tn</p>
          <p className="text-sm text-primary font-medium mt-0.5">{FMT_PCT.format(descuento)}% de descuento</p>
        </div>
      </header>

      {/* KPIs técnicos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Wheat className="h-4 w-4" />} label="Cultivo" value={<span className="capitalize">{cultivo}</span>} />
        <KpiCard icon={<MapPin className="h-4 w-4" />} label="Ubicación" value={ubic || '—'} />
        <KpiCard icon={<Package className="h-4 w-4" />} label="Hectáreas" value={`${hectareas.toLocaleString('es-AR')} ha`} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Rinde estimado" value={`${FMT_PCT.format(rindeEstimado)} tn/ha`} />
      </div>

      {/* Fondeo */}
      <section className="rounded-2xl bg-surface border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fondeo</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            Cierra el {FMT_FECHA.format(cierre)}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {data.disponibilidad.tokensVendidos.toLocaleString('es-AR')} de{' '}
              {data.disponibilidad.tokensTotales.toLocaleString('es-AR')} tokens vendidos
            </span>
            <span className="font-semibold">{FMT_PCT.format(data.disponibilidad.pctFondeado)}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, data.disponibilidad.pctFondeado)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>{data.disponibilidad.tokensReservados.toLocaleString('es-AR')} reservados</span>
            <span className="text-primary font-medium">
              {data.disponibilidad.tokensDisponibles.toLocaleString('es-AR')} disponibles
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Producción estimada</p>
            <p className="font-medium">{produccionEstimadaTn.toLocaleString('es-AR')} tn</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Modo</p>
            <p className="font-medium capitalize">
              {data.modo === 'porcentual'
                ? `${data.porcentaje ?? 0}% de la producción`
                : `${data.toneladasFijas?.toLocaleString('es-AR') ?? 0} tn fijas`}
            </p>
          </div>
        </div>
      </section>

      {/* Garantías */}
      {conGarantias && (
        <section className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Garantías declaradas</h3>
          </div>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {data.tieneSeguroGranizo && <li>· Seguro granizo</li>}
            {data.tieneSeguroParametrico && <li>· Seguro paramétrico</li>}
            {data.tieneAvalSgr && <li>· Aval SGR</li>}
          </ul>
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-primary/10">
            Información declarada por el productor. Se muestra a título informativo — la liquidación
            no depende de que estas garantías se ejecuten (fase 2).
          </p>
        </section>
      )}

      {/* Simulador */}
      <section className="rounded-2xl bg-surface border border-border p-5 space-y-4">
        <h2 className="text-lg font-semibold">Simulador de retorno</h2>
        <p className="text-sm text-muted-foreground">
          Movés la cantidad y el precio final esperado y ves cuánto ganás si la campaña liquida a ese
          precio. Es una estimación — el precio real lo declara el acopio al momento de la cosecha.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">
              Toneladas a comprar (máx. {data.disponibilidad.tokensDisponibles.toLocaleString('es-AR')})
            </label>
            <input
              type="number"
              min={1}
              max={data.disponibilidad.tokensDisponibles}
              value={tonelasSimuladas}
              onChange={(e) => setToneladasSimuladas(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Precio esperado de liquidación (USD/tn)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={precioFinalEsperado ?? ''}
              placeholder={`Actual: ${FMT_USD.format(precioToken)}`}
              onChange={(e) => setPrecioFinalEsperado(e.target.value === '' ? null : Number(e.target.value))}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background"
            />
          </div>
        </div>

        {simulacion && (
          <div className="rounded-xl bg-muted/40 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Inversión</p>
              <p className="font-semibold">{FMT_USD_INT.format(simulacion.inversion)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Precio liquidación</p>
              <p className="font-semibold">{FMT_USD.format(simulacion.precioLiquidacion)}/tn</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Retorno estimado</p>
              <p className={`font-semibold ${simulacion.retornoTotal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {FMT_USD_INT.format(simulacion.retornoTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rendimiento</p>
              <p className={`font-semibold ${simulacion.retornoPct >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {FMT_PCT.format(simulacion.retornoPct)}%
              </p>
            </div>
          </div>
        )}
      </section>

      {/* CTA compra */}
      <div className="sticky bottom-4 rounded-2xl bg-surface border border-border p-4 shadow-lift flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total a invertir</p>
          <p className="text-xl font-semibold">
            {simulacion ? FMT_USD_INT.format(simulacion.inversion) : FMT_USD_INT.format(precioToken)}
          </p>
        </div>
        {puedeComprar ? (
          <button
            onClick={() => setSheetCompraOpen(true)}
            disabled={data.disponibilidad.tokensDisponibles <= 0}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {data.disponibilidad.tokensDisponibles > 0
              ? `Comprar ${tonelasSimuladas.toLocaleString('es-AR')} tn`
              : 'Sin stock'}
          </button>
        ) : (
          <Link
            to={usuario ? '/marketplace' : '/registro'}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            {usuario ? 'Cambiá a rol inversor para comprar' : 'Registrate para invertir'}
          </Link>
        )}
      </div>

      {puedeComprar && (
        <SheetCompra
          emision={data}
          cantidadInicial={tonelasSimuladas}
          open={sheetCompraOpen}
          onOpenChange={setSheetCompraOpen}
        />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-base font-semibold mt-1">{value}</p>
    </div>
  );
}
