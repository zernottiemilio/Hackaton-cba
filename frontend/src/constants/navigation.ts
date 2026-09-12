import {
  Home, Tractor, Sprout, CalendarRange, ClipboardList,
  Beaker, BarChart3, Wheat, CloudRain, CloudSun, Sparkles,
  Store, Briefcase, Wallet, Warehouse, Shield, ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import type { RolPlataforma } from '@/stores/authStore';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
}

// ─── Productor · gestión agronómica + emisiones ─────────────
export const navItemsProductor: NavItem[] = [
  { to: '/',                  label: 'Inicio',           icon: Home,          keywords: ['dashboard'] },
  { to: '/establecimientos',  label: 'Establecimientos', icon: Tractor,       keywords: ['campo', 'finca'] },
  { to: '/lotes',             label: 'Lotes',            icon: Sprout,       keywords: ['parcela'] },
  { to: '/campanias',         label: 'Campañas',         icon: CalendarRange, keywords: ['fina', 'gruesa'] },
  { to: '/carga',             label: 'Carga',            icon: ClipboardList, keywords: ['labores', 'insumos'] },
  { to: '/emisiones',         label: 'Mis emisiones',    icon: Wallet,        keywords: ['tokenizar', 'financiar'] },
  { to: '/lluvias',           label: 'Lluvias',          icon: CloudRain,     keywords: ['mm', 'calendario'] },
  { to: '/clima',             label: 'Clima',            icon: CloudSun,      keywords: ['pronostico'] },
  { to: '/asistente',         label: 'Asistente IA',     icon: Sparkles,      keywords: ['chat', 'claude'] },
  { to: '/cultivos',          label: 'Cultivos',         icon: Wheat,         keywords: ['catalogo'] },
  { to: '/insumos',           label: 'Insumos',          icon: Beaker,        keywords: ['fertilizante'] },
  { to: '/resumen',           label: 'Resumen',          icon: BarChart3,     keywords: ['margen', 'punto eq'] },
];

// ─── Inversor · marketplace + portfolio ─────────────────────
export const navItemsInversor: NavItem[] = [
  { to: '/marketplace',       label: 'Marketplace',      icon: Store,         keywords: ['campañas', 'invertir'] },
  { to: '/portfolio',         label: 'Mi portfolio',     icon: Briefcase,     keywords: ['tenencias', 'tokens'] },
];

// ─── Acopio · panel + liquidaciones ─────────────────────────
export const navItemsAcopio: NavItem[] = [
  { to: '/acopio',            label: 'Panel',            icon: Warehouse,     keywords: ['emisiones asignadas'] },
  { to: '/acopio/liquidar',   label: 'Liquidar',         icon: ClipboardCheck, keywords: ['toneladas', 'precio final'] },
];

// ─── Admin plataforma · cola de revisión + usuarios ─────────
export const navItemsAdmin: NavItem[] = [
  { to: '/admin',             label: 'Panel',            icon: Shield,        keywords: ['cola', 'revisión'] },
];

export function navItemsPorRol(rol: RolPlataforma | null): NavItem[] {
  switch (rol) {
    case 'productor':
      return navItemsProductor;
    case 'inversor':
      return navItemsInversor;
    case 'acopio':
      return navItemsAcopio;
    case 'admin_plataforma':
      return navItemsAdmin;
    default:
      // Usuarios legacy sin rol Harvest — le mostramos el nav del MVP.
      return navItemsProductor;
  }
}

/**
 * Compat: `navItems` sigue existiendo como el menú del productor por defecto
 * para el código que aún no fue migrado. Preferí `navItemsPorRol(usuario.rolPlataforma)`.
 */
export const navItems: NavItem[] = navItemsProductor;
