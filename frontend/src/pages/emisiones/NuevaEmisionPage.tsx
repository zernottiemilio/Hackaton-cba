import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, MapPin, Send, ShieldCheck, Sprout,
  TrendingUp, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, extraerMensajeError } from '@/lib/apiClient';
import { tokenizadasService } from '@/services/tokenizadasService';
import { useAuthStore } from '@/stores/authStore';
import { BloqueVinculacionMock } from '@/components/wallet/BloqueVinculacionMock';

interface Establecimiento {
  id: string;
  nombre: string;
  localidad?: string | null;
  provincia?: string | null;
}

const schema = z
  .object({
    // Paso 1 — Campo + cultivo
    establecimientoId: z.string().uuid('Elegí un campo'),
    cultivoId: z.string().uuid('Elegí un cultivo'),
    nombreCampania: z.string().trim().min(3, 'Nombre muy corto'),
    cicloAgricola: z.string().regex(/^\d{4}\/\d{2}$/, 'Formato "2026/27"'),

    // Paso 2 — Producción
    hectareasAfectadas: z.coerce.number().positive('Debe ser > 0'),
    rindeEstimadoTnHa: z.coerce.number().positive('Debe ser > 0'),
    fechaSiembraEstimada: z.string().min(1, 'Fecha requerida'),
    fechaCosechaEstimada: z.string().min(1, 'Fecha requerida'),

    // Paso 3 — Modo + cotización
    modo: z.enum(['porcentual', 'fijo']),
    porcentaje: z.coerce.number().min(1).max(100).optional(),
    toneladasFijas: z.coerce.number().positive().optional(),
    fuentePrecio: z.enum(['pizarra_rosario', 'matba_futuro', 'manual']),
    precioReferenciaUsdTn: z.coerce.number().positive('Debe ser > 0'),
    descuentoPct: z.coerce.number().min(0).max(20),
    fondeoDesde: z.string().min(1, 'Fecha requerida'),
    fondeoHasta: z.string().min(1, 'Fecha requerida'),

    // Paso 4 — Garantías
    tieneSeguroGranizo: z.boolean(),
    tieneSeguroParametrico: z.boolean(),
    tieneAvalSgr: z.boolean(),
  })
  .refine((d) => d.modo === 'porcentual' ? !!d.porcentaje : !!d.toneladasFijas, {
    message: 'Definí porcentaje o toneladas según el modo',
    path: ['porcentaje'],
  });

// Input type: lo que el form maneja antes del coerce (strings viniendo de HTML inputs).
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const PASOS = ['Campo', 'Producción', 'Cotización', 'Garantías'] as const;

export function NuevaEmisionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const walletAddress = useAuthStore((s) => s.usuario?.walletAddress);
  const [paso, setPaso] = useState(0);
  const [emisionCreada, setEmisionCreada] = useState<{ id: string; precioTokenUsd: string } | null>(null);

  const { data: campos } = useQuery({
    queryKey: ['tokenizadas-campos'],
    queryFn: async () => (await apiClient.get<Establecimiento[]>('/tokenizadas/campos')).data,
  });

  const { data: cultivos } = useQuery({
    queryKey: ['tokenizadas-cultivos'],
    queryFn: () => tokenizadasService.listarCultivos(),
  });

  const form = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      cicloAgricola: '2026/27',
      modo: 'porcentual',
      porcentaje: 30,
      fuentePrecio: 'pizarra_rosario',
      descuentoPct: 5,
      tieneSeguroGranizo: false,
      tieneSeguroParametrico: false,
      tieneAvalSgr: false,
    },
  });

  const { register, handleSubmit, watch, formState: { errors, isValid } } = form;
  const modo = watch('modo');
  const precioRef = Number(watch('precioReferenciaUsdTn') ?? 0);
  const descuentoPct = Number(watch('descuentoPct') ?? 0);
  const precioTokenPreview = precioRef * (1 - descuentoPct / 100);

  const crear = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post('/tokenizadas', {
        campaniaNueva: {
          nombre: data.nombreCampania,
          establecimientoId: data.establecimientoId,
          cultivoId: data.cultivoId,
          cicloAgricola: data.cicloAgricola,
          hectareasAfectadas: data.hectareasAfectadas,
          rindeEstimadoTnHa: data.rindeEstimadoTnHa,
          fechaSiembraEstimada: data.fechaSiembraEstimada,
          fechaCosechaEstimada: data.fechaCosechaEstimada,
        },
        modo: data.modo,
        porcentaje: data.modo === 'porcentual' ? data.porcentaje : undefined,
        toneladasFijas: data.modo === 'fijo' ? data.toneladasFijas : undefined,
        fuentePrecio: data.fuentePrecio,
        precioReferenciaUsdTn: data.precioReferenciaUsdTn,
        descuentoPct: data.descuentoPct,
        fondeoDesde: data.fondeoDesde,
        fondeoHasta: data.fondeoHasta,
        tieneSeguroGranizo: data.tieneSeguroGranizo,
        tieneSeguroParametrico: data.tieneSeguroParametrico,
        tieneAvalSgr: data.tieneAvalSgr,
      }),
    onSuccess: (res) => {
      const data = res.data as { id: string; precioTokenUsd: string };
      setEmisionCreada(data);
      queryClient.invalidateQueries({ queryKey: ['mis-campanas'] });
      toast.success('Emisión creada en borrador');
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  const enviarRevision = useMutation({
    mutationFn: (id: string) => apiClient.post(`/tokenizadas/${id}/enviar-revision`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-campanas'] });
      toast.success('Emisión enviada a revisión');
      navigate('/emisiones');
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  const puedeAvanzar = () => {
    const values = form.getValues();
    if (paso === 0) return !!(values.establecimientoId && values.cultivoId && values.nombreCampania && values.cicloAgricola);
    if (paso === 1) return !!(values.hectareasAfectadas && values.rindeEstimadoTnHa && values.fechaSiembraEstimada && values.fechaCosechaEstimada);
    if (paso === 2) {
      const modoOk = values.modo === 'porcentual' ? !!values.porcentaje : !!values.toneladasFijas;
      return modoOk && !!values.precioReferenciaUsdTn && !!values.fondeoDesde && !!values.fondeoHasta;
    }
    return true;
  };

  // ─── Pantalla post-creación ─────────────────────────
  if (emisionCreada) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <div className="text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-semibold">Emisión creada</h1>
          <p className="text-muted-foreground">
            Precio por token: <span className="font-semibold text-foreground">
              USD {Number(emisionCreada.precioTokenUsd).toFixed(2)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Está en <span className="font-medium">borrador</span>. Enviala a revisión para que
            el admin la habilite en el marketplace.
          </p>
        </div>

        {!walletAddress ? (
          <BloqueVinculacionMock
            motivo="La wallet firma el envío a revisión y recibe el fondeo cuando se llegue al mínimo."
            onConectado={() => {}}
          />
        ) : (
          <button
            onClick={() => enviarRevision.mutate(emisionCreada.id)}
            disabled={enviarRevision.isPending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {enviarRevision.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar a revisión
          </button>
        )}

        <div className="text-center">
          <Link to="/emisiones" className="text-sm text-muted-foreground hover:text-foreground">
            Volver a mis emisiones
          </Link>
        </div>
      </div>
    );
  }

  // ─── Wizard ────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/emisiones" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mis emisiones
      </Link>

      {/* Progreso */}
      <div>
        <h1 className="text-2xl font-semibold">Nueva emisión</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tokenizá una parte de tu producción para financiar la siembra.
        </p>
        <ol className="mt-6 flex items-center gap-2">
          {PASOS.map((label, i) => (
            <li key={label} className="flex-1 flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  i < paso ? 'bg-primary text-primary-foreground'
                  : i === paso ? 'bg-primary/15 text-primary border-2 border-primary'
                  : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < paso ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs ${i === paso ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
              {i < PASOS.length - 1 && <div className="flex-1 h-0.5 bg-border ml-2" />}
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={handleSubmit((d) => crear.mutate(d))} className="space-y-6">
        {/* PASO 1 · Campo + cultivo */}
        {paso === 0 && (
          <Seccion titulo="Campo y cultivo" icon={<Sprout />}>
            <Campo label="Campo" error={errors.establecimientoId?.message}>
              <select
                {...register('establecimientoId')}
                className="w-full h-11 px-3 rounded-lg border border-border bg-background"
              >
                <option value="">Elegí un campo…</option>
                {campos?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.localidad ? ` — ${c.localidad}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Reusa tus campos ya cargados en AgroFácil.
              </p>
            </Campo>

            <Campo label="Cultivo" error={errors.cultivoId?.message}>
              <select
                {...register('cultivoId')}
                className="w-full h-11 px-3 rounded-lg border border-border bg-background"
              >
                <option value="">Elegí un cultivo…</option>
                {cultivos?.map((c) => (
                  <option key={c.id} value={c.id} className="capitalize">{c.nombre}</option>
                ))}
              </select>
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre de la campaña" error={errors.nombreCampania?.message}>
                <input {...register('nombreCampania')} placeholder="Soja 2026/27" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
              <Campo label="Ciclo agrícola" error={errors.cicloAgricola?.message}>
                <input {...register('cicloAgricola')} placeholder="2026/27" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
            </div>
          </Seccion>
        )}

        {/* PASO 2 · Producción */}
        {paso === 1 && (
          <Seccion titulo="Datos de producción" icon={<TrendingUp />}>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Hectáreas afectadas" error={errors.hectareasAfectadas?.message}>
                <input type="number" step="0.01" {...register('hectareasAfectadas')} placeholder="240" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
              <Campo label="Rinde estimado (tn/ha)" error={errors.rindeEstimadoTnHa?.message}>
                <input type="number" step="0.01" {...register('rindeEstimadoTnHa')} placeholder="4.2" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
              <Campo label="Fecha de siembra estimada" error={errors.fechaSiembraEstimada?.message}>
                <input type="date" {...register('fechaSiembraEstimada')} className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
              <Campo label="Fecha de cosecha estimada" error={errors.fechaCosechaEstimada?.message}>
                <input type="date" {...register('fechaCosechaEstimada')} className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
            </div>
          </Seccion>
        )}

        {/* PASO 3 · Modo + cotización */}
        {paso === 2 && (
          <Seccion titulo="Modo y cotización" icon={<Wallet />}>
            <Campo label="Modo de tokenización">
              <div className="grid grid-cols-2 gap-2">
                {(['porcentual', 'fijo'] as const).map((m) => (
                  <label key={m} className={`p-3 rounded-lg border cursor-pointer text-sm ${modo === m ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input type="radio" value={m} {...register('modo')} className="sr-only" />
                    <span className="capitalize font-medium">{m}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {m === 'porcentual' ? '% de la producción' : 'Toneladas fijas'}
                    </p>
                  </label>
                ))}
              </div>
            </Campo>

            {modo === 'porcentual' ? (
              <Campo label="Porcentaje ofrecido (%)" error={errors.porcentaje?.message}>
                <input type="number" step="1" min="1" max="100" {...register('porcentaje')} placeholder="30" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
            ) : (
              <Campo label="Toneladas fijas ofrecidas" error={errors.toneladasFijas?.message}>
                <input type="number" step="1" {...register('toneladasFijas')} placeholder="300" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fuente de precio">
                <select {...register('fuentePrecio')} className="w-full h-11 px-3 rounded-lg border border-border bg-background">
                  <option value="pizarra_rosario">Pizarra Rosario</option>
                  <option value="matba_futuro">MATBA / futuro</option>
                  <option value="manual">Manual</option>
                </select>
              </Campo>
              <Campo label="Precio referencia (USD/tn)" error={errors.precioReferenciaUsdTn?.message}>
                <input type="number" step="0.01" {...register('precioReferenciaUsdTn')} placeholder="320" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
              <Campo label="Descuento (%)" error={errors.descuentoPct?.message}>
                <input type="number" step="0.1" min="0" max="20" {...register('descuentoPct')} placeholder="5" className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex flex-col justify-center">
                <p className="text-xs text-primary uppercase tracking-wide">Precio por token</p>
                <p className="text-lg font-semibold text-primary">USD {precioTokenPreview.toFixed(2)}/tn</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <Campo label="Fondeo desde" error={errors.fondeoDesde?.message}>
                <input type="date" {...register('fondeoDesde')} className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
              <Campo label="Fondeo hasta" error={errors.fondeoHasta?.message}>
                <input type="date" {...register('fondeoHasta')} className="w-full h-11 px-3 rounded-lg border border-border bg-background" />
              </Campo>
            </div>
          </Seccion>
        )}

        {/* PASO 4 · Garantías */}
        {paso === 3 && (
          <Seccion titulo="Garantías declaradas" icon={<ShieldCheck />}>
            <p className="text-sm text-muted-foreground">
              Se muestran a los inversores como información. En este ciclo del hackaton no se
              ejecutan si hay fallas — quedan como declaración del productor.
            </p>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40">
              <input type="checkbox" {...register('tieneSeguroGranizo')} className="h-4 w-4" />
              <div>
                <span className="font-medium text-sm">Seguro contra granizo</span>
                <p className="text-xs text-muted-foreground">Cobertura tradicional del cultivo.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40">
              <input type="checkbox" {...register('tieneSeguroParametrico')} className="h-4 w-4" />
              <div>
                <span className="font-medium text-sm">Seguro paramétrico</span>
                <p className="text-xs text-muted-foreground">Cobertura por índices climáticos.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40">
              <input type="checkbox" {...register('tieneAvalSgr')} className="h-4 w-4" />
              <div>
                <span className="font-medium text-sm">Aval SGR</span>
                <p className="text-xs text-muted-foreground">Sociedad de Garantía Recíproca.</p>
              </div>
            </label>
          </Seccion>
        )}

        {/* Navegación */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPaso((p) => Math.max(0, p - 1))}
            disabled={paso === 0}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4 inline mr-1" />
            Anterior
          </button>

          {paso < PASOS.length - 1 ? (
            <button
              type="button"
              onClick={() => puedeAvanzar() && setPaso((p) => p + 1)}
              disabled={!puedeAvanzar()}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              Siguiente
              <ArrowRight className="h-4 w-4 inline ml-1" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={crear.isPending || !isValid}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              {crear.isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
              Crear emisión
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Seccion({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface border border-border p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-primary">{icon}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </label>
  );
}
