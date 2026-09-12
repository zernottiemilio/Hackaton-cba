import {
  Home, Tractor, Sprout, CalendarRange, ClipboardList,
  Beaker, BarChart3, Wheat, CloudRain, CloudSun, Sparkles,
  Store, Briefcase, Wallet, Warehouse, Shield, ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import type { TipoUsuario } from '@/stores/authStore';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
}

// ─── Propietario · gestión agronómica + emisiones ───────────
export const navItemsPropietario: NavItem[] = [
  { to: '/',                  label: 'Inicio',           icon: Home,          keywords: ['vivero', 'dashboard'] },
  { to: '/establecimientos',  label: 'Establecimientos', icon: Tractor,       keywords: ['campo', 'finca'] },
  { to: '/lotes',             label: 'Lotes',            icon: Sprout,       keywords: ['parcela', 'potrero'] },
  { to: '/campanias',         label: 'Campañas',         icon: CalendarRange, keywords: ['fina', 'gruesa'] },
  { to: '/carga',             label: 'Carga',            icon: ClipboardList, keywords: ['labores', 'insumos', 'voz', 'foto'] },
  { to: '/emisiones',         label: 'Mis emisiones',    icon: Wallet,        keywords: ['tokenizar', 'financiar'] },
  { to: '/lluvias',           label: 'Lluvias',          icon: CloudRain,     keywords: ['mm', 'agua', 'calendario'] },
  { to: '/clima',             label: 'Clima',            icon: CloudSun,      keywords: ['pronostico', 'temperatura'] },
  { to: '/asistente',         label: 'Asistente IA',     icon: Sparkles,      keywords: ['chat', 'claude', 'ia'] },
  { to: '/cultivos',          label: 'Cultivos',         icon: Wheat,         keywords: ['catalogo'] },
  { to: '/insumos',           label: 'Insumos',          icon: Beaker,        keywords: ['fertilizante', 'herbicida'] },
  { to: '/resumen',           label: 'Resumen',          icon: BarChart3,     keywords: ['resultado', 'margen', 'punto eq'] },
];

// ─── Inversor · marketplace + portfolio ─────────────────────
export const navItemsInversor: NavItem[] = [
  { to: '/marketplace',       label: 'Marketplace',      icon: Store,         keywords: ['campañas', 'invertir', 'oportunidades'] },
  { to: '/portfolio',         label: 'Mi portfolio',     icon: Briefcase,     keywords: ['tenencias', 'inversiones', 'tokens'] },
];

// ─── Acopio · panel + liquidaciones ─────────────────────────
export const navItemsAcopio: NavItem[] = [
  { to: '/acopio',            label: 'Panel',            icon: Warehouse,     keywords: ['emisiones asignadas'] },
  { to: '/acopio/liquidar',   label: 'Liquidar',         icon: ClipboardCheck, keywords: ['toneladas', 'precio final'] },
];

// ─── Admin · cola de revisión + usuarios ────────────────────
export const navItemsAdmin: NavItem[] = [
  { to: '/admin',             label: 'Panel',            icon: Shield,        keywords: ['cola', 'revisión'] },
];

export function navItemsPorTipo(tipo: TipoUsuario): NavItem[] {
  switch (tipo) {
    case 'propietario':
      return navItemsPropietario;
    case 'inversor':
      return navItemsInversor;
    case 'acopio':
      return navItemsAcopio;
    case 'admin':
      return navItemsAdmin;
  }
}

/**
 * Compat: `navItems` sigue existiendo como el menú del propietario para el
 * código que aún no fue migrado a `navItemsPorTipo` (por ejemplo el
 * CommandPalette). Preferí `navItemsPorTipo(usuario.tipo)` en código nuevo.
 */
export const navItems: NavItem[] = navItemsPropietario;
