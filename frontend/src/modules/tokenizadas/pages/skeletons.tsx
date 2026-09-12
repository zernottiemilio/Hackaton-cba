/**
 * Páginas skeleton para las rutas del módulo tokenizadas que todavía no
 * están implementadas. El shell existe y navega correctamente; cada
 * página irá siendo reemplazada en los sprints siguientes.
 */

import { Link } from 'react-router-dom';

interface SkeletonProps {
  titulo: string;
  descripcion: string;
  sprint?: string;
  emoji?: string;
}

function PageSkeleton({ titulo, descripcion, sprint, emoji = '🧪' }: SkeletonProps) {
  return (
    <div className="max-w-3xl mx-auto py-16">
      <div className="text-center">
        <div className="text-5xl mb-4 opacity-70">{emoji}</div>
        <h1 className="text-white text-2xl font-semibold mb-2">{titulo}</h1>
        <p className="text-white/50 text-sm max-w-md mx-auto">{descripcion}</p>
        {sprint && (
          <div className="mt-6 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
            <span>⏳</span>
            <span>{sprint}</span>
          </div>
        )}
        <div className="mt-8">
          <Link to="/tk" className="text-white/40 hover:text-white/80 text-sm">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

// Productor
export const MisCampanasProductorPage = () => (
  <PageSkeleton
    titulo="Mis campañas"
    descripcion="Listado de tus campañas tokenizadas con estado, fondeo, inversores y avance."
    sprint="Sprint 3"
    emoji="🗂️"
  />
);

// Acopio
export const AcopioDashboardPage = () => (
  <PageSkeleton
    titulo="Tablero de acopio"
    descripcion="Solo toneladas. Nunca información financiera. Afectaciones vigentes por planta con semáforo."
    sprint="Sprint 5"
    emoji="🏭"
  />
);

export const RecepcionPage = () => (
  <PageSkeleton
    titulo="Recepción de camión"
    descripcion="Escaneo de CTG → resolución contra afectaciones → carga de pesada. Optimizado para tablet."
    sprint="Sprint 5"
    emoji="🚚"
  />
);

export const PosicionesPage = () => (
  <PageSkeleton
    titulo="Posiciones"
    descripcion="Campañas afectadas a tus plantas: comprometido, recibido, pendiente, semáforo."
    sprint="Sprint 5"
    emoji="📊"
  />
);

export const LiberacionesPage = () => (
  <PageSkeleton
    titulo="Liberaciones"
    descripcion="Grano que podés devolver al productor. Con candado y motivo cuando está afectado."
    sprint="Sprint 5"
    emoji="🔓"
  />
);

// Admin
export const RevisionColaPage = () => (
  <PageSkeleton
    titulo="Cola de revisión"
    descripcion="Campañas esperando aprobación. Aprobás o rechazás con motivo."
    sprint="Sprint 3"
    emoji="⚑"
  />
);

export const AdminAcopiosPage = () => (
  <PageSkeleton
    titulo="Red de acopios"
    descripcion="Acopios aliados con estado SISA, convenio marco firmado y nivel de integración."
    sprint="Sprint 5"
    emoji="🤝"
  />
);

export const ConciliacionPage = () => (
  <PageSkeleton
    titulo="Conciliación"
    descripcion="Bandeja de desvíos y huérfanos: CTG sin afectación asociada o grano que fue a otro destino."
    sprint="Sprint 5"
    emoji="⚙️"
  />
);
