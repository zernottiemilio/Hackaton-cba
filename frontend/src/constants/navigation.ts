import {
  Home, Tractor, Sprout, CalendarRange,
  Beaker, BarChart3, Wheat, CloudRain, CloudSun, Sparkles, UserPlus, FileText, Bell, Trophy, Users2,
  type LucideIcon,
} from 'lucide-react';
import type { RolEnCuenta } from '@/stores/authStore';
import { modulosVisibles, type ModuloId } from '@/constants/modulos';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  /** Roles que pueden ver este item. Vacío/undefined = todos. */
  roles?: RolEnCuenta[];
  /** ID del módulo en el catálogo de permisos. Si está, se respeta `modulosPermitidos`. */
  modulo?: ModuloId;
}

export interface NavGroup {
  id: string;
  /** Etiqueta del grupo. null = sin header (items "flotantes" arriba). */
  label: string | null;
  /** Si el grupo arranca colapsado por defecto. */
  defaultCollapsed?: boolean;
  items: NavItem[];
}

/**
 * La nav está agrupada por área. Cada grupo se puede colapsar/expandir
 * desde el sidebar; el estado se persiste en localStorage.
 */
export const navGroups: NavGroup[] = [
  {
    id: 'principal',
    label: null,
    items: [
      { to: '/', label: 'Inicio', icon: Home, keywords: ['vivero', 'dashboard'] },
    ],
  },
  {
    id: 'mi-campo',
    label: 'Mi campo',
    items: [
      { to: '/establecimientos', label: 'Empresa', icon: Tractor, keywords: ['campo', 'finca', 'establecimiento', 'empresa'], modulo: 'establecimientos' },
      { to: '/lotes',            label: 'Lotes',            icon: Sprout,  keywords: ['parcela', 'potrero'], modulo: 'lotes' },
      { to: '/campanias',        label: 'Campañas',         icon: CalendarRange, keywords: ['fina', 'gruesa'], modulo: 'campanias' },
    ],
  },
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { to: '/lluvias',   label: 'Lluvias',      icon: CloudRain,     keywords: ['mm', 'agua', 'calendario'], modulo: 'lluvias' },
      { to: '/clima',     label: 'Clima',        icon: CloudSun,      keywords: ['pronostico', 'temperatura', 'humedad', 'viento', 'open-meteo'], modulo: 'clima' },
      { to: '/asistente', label: 'Asistente IA', icon: Sparkles,      keywords: ['chat', 'claude', 'preguntar', 'ayuda', 'ia'], modulo: 'asistente' },
    ],
  },
  {
    id: 'catalogos',
    label: 'Catálogos',
    defaultCollapsed: true,
    items: [
      { to: '/cultivos', label: 'Cultivos', icon: Wheat,  keywords: ['catalogo', 'variedades'], modulo: 'cultivos' },
      { to: '/insumos',  label: 'Insumos',  icon: Beaker, keywords: ['fertilizante', 'herbicida', 'stock', 'inventario'], modulo: 'insumos' },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    items: [
      { to: '/resumen',  label: 'Resumen',  icon: BarChart3, keywords: ['resultado', 'margen', 'punto eq'], modulo: 'resumen' },
      { to: '/ranking',  label: 'Ranking',  icon: Trophy,    keywords: ['comparar', 'mejor', 'peor', 'productivo', 'costos'], modulo: 'ranking' },
      { to: '/reportes', label: 'Reportes', icon: FileText,  keywords: ['compartir', 'pdf', 'link', 'comentarios'], modulo: 'reportes' },
      { to: '/alertas',  label: 'Alertas',  icon: Bell,      keywords: ['notificaciones', 'aviso', 'recordatorio'], modulo: 'alertas' },
    ],
  },
  {
    id: 'equipo',
    label: 'Equipo',
    defaultCollapsed: true,
    items: [
      { to: '/equipo',       label: 'Equipo',       icon: Users2,   keywords: ['miembros', 'usuarios', 'invitar', 'permisos'], modulo: 'equipo', roles: ['ingeniero'] },
      { to: '/propietarios', label: 'Propietarios', icon: UserPlus, keywords: ['acceso', 'productor', 'cliente', 'invitar'], roles: ['ingeniero'] },
    ],
  },
];

/** Plana sin grupos — útil para command palette y compatibilidad. */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export function filtrarPorRol(items: NavItem[], rol: RolEnCuenta | undefined): NavItem[] {
  if (!rol) return items;
  return items.filter((i) => !i.roles || i.roles.includes(rol));
}

/// Filtra por rol + (si está set) por `modulosPermitidos` explícitos.
/// Items sin `modulo` no se gatean por permisos (Inicio, Propietarios legacy).
export function filtrarItems(
  items: NavItem[],
  rol: RolEnCuenta | undefined,
  modulosExplicitos: string[] | undefined,
): NavItem[] {
  if (!rol) return items;
  const visibles = modulosVisibles(rol, modulosExplicitos);
  return items.filter((i) => {
    if (i.roles && !i.roles.includes(rol)) return false;
    if (i.modulo && !visibles.has(i.modulo)) return false;
    return true;
  });
}

export function filtrarGruposPorRol(groups: NavGroup[], rol: RolEnCuenta | undefined): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: filtrarPorRol(g.items, rol) }))
    .filter((g) => g.items.length > 0);
}

export function filtrarGruposPorPermisos(
  groups: NavGroup[],
  rol: RolEnCuenta | undefined,
  modulosExplicitos: string[] | undefined,
): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: filtrarItems(g.items, rol, modulosExplicitos) }))
    .filter((g) => g.items.length > 0);
}
