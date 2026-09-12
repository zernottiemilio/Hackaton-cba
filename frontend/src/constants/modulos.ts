import type { RolEnCuenta } from '@/stores/authStore';

/// Catálogo de módulos. Mirror del archivo del backend (`src/common/constants/modulos.ts`).
/// Mantener ambos lados sincronizados.

export const MODULO_IDS = [
  'establecimientos',
  'lotes',
  'campanias',
  'lluvias',
  'clima',
  'asistente',
  'cultivos',
  'insumos',
  'resumen',
  'ranking',
  'reportes',
  'alertas',
  'equipo',
] as const;

export type ModuloId = typeof MODULO_IDS[number];

export interface ModuloDef {
  id: ModuloId;
  label: string;
  defaultsPorRol: Record<RolEnCuenta, boolean>;
}

export const MODULOS: ModuloDef[] = [
  { id: 'establecimientos', label: 'Establecimientos', defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'lotes',            label: 'Lotes',            defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'campanias',        label: 'Campañas',         defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'lluvias',          label: 'Lluvias',          defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'clima',            label: 'Clima',            defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'asistente',        label: 'Asistente IA',     defaultsPorRol: { ingeniero: true, propietario: false, operador: true } },
  { id: 'cultivos',         label: 'Cultivos',         defaultsPorRol: { ingeniero: true, propietario: false, operador: false } },
  { id: 'insumos',          label: 'Insumos',          defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'resumen',          label: 'Resumen',          defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'ranking',          label: 'Ranking',          defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'reportes',         label: 'Reportes',         defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'alertas',          label: 'Alertas',          defaultsPorRol: { ingeniero: true, propietario: true, operador: true } },
  { id: 'equipo',           label: 'Equipo',           defaultsPorRol: { ingeniero: true, propietario: false, operador: false } },
];

/// Resuelve qué módulos ve un usuario según su rol y sus permisos explícitos.
/// Si `modulosExplicitos` está vacío → fallback a defaults del rol.
/// Si tiene contenido → allowlist exacta.
export function modulosVisibles(rol: RolEnCuenta, modulosExplicitos: string[] | undefined): Set<ModuloId> {
  const explicitos = modulosExplicitos ?? [];
  if (explicitos.length > 0) {
    return new Set(explicitos.filter((id): id is ModuloId => (MODULO_IDS as readonly string[]).includes(id)));
  }
  return new Set(MODULOS.filter((m) => m.defaultsPorRol[rol]).map((m) => m.id));
}
