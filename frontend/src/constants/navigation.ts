import {
  Home, Tractor, Sprout, CalendarRange, ClipboardList,
  Beaker, BarChart3, Wheat, CloudRain, CloudSun, Sparkles, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
}

export const navItems: NavItem[] = [
  { to: '/',                  label: 'Inicio',          icon: Home,          keywords: ['vivero', 'dashboard'] },
  { to: '/establecimientos',  label: 'Establecimientos', icon: Tractor,      keywords: ['campo', 'finca'] },
  { to: '/lotes',             label: 'Lotes',            icon: Sprout,       keywords: ['parcela', 'potrero'] },
  { to: '/campanias',         label: 'Campañas',         icon: CalendarRange, keywords: ['fina', 'gruesa'] },
  { to: '/carga',             label: 'Carga',            icon: ClipboardList, keywords: ['labores', 'insumos', 'voz', 'foto'] },
  { to: '/lluvias',           label: 'Lluvias',          icon: CloudRain,     keywords: ['mm', 'agua', 'calendario'] },
  { to: '/clima',             label: 'Clima',            icon: CloudSun,      keywords: ['pronostico', 'temperatura', 'humedad', 'viento', 'open-meteo'] },
  { to: '/asistente',         label: 'Asistente IA',     icon: Sparkles,      keywords: ['chat', 'claude', 'preguntar', 'ayuda', 'ia'] },
  { to: '/cultivos',          label: 'Cultivos',         icon: Wheat,         keywords: ['catalogo'] },
  { to: '/insumos',           label: 'Insumos',          icon: Beaker,        keywords: ['fertilizante', 'herbicida'] },
  { to: '/resumen',           label: 'Resumen',          icon: BarChart3,     keywords: ['resultado', 'margen', 'punto eq'] },
];
