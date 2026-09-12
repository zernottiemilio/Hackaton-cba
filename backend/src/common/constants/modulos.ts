import type { RolEnCuenta } from '@prisma/client';

/// IDs de los módulos disponibles. Coinciden 1:1 con los keys que usa el frontend
/// para filtrar el sidebar. Si agregás un módulo nuevo en la app, sumalo acá.
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
  /// Si está en `defaultsPorRol[rol]`, el rol lo ve por defecto cuando la
  /// membresía no tiene `modulosPermitidos` explícito (lista vacía).
  defaultsPorRol: Record<RolEnCuenta, boolean>;
}

/// Catálogo de módulos visibles. `inicio` no está acá porque siempre se ve.
/// El default por rol modela lo que ya estaba en navigation.ts del frontend.
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
  /// Acceso al panel "Equipo" — gestionar otros miembros de la cuenta.
  /// Por defecto solo el ingeniero. Se puede dar a otros explícitamente.
  { id: 'equipo',           label: 'Equipo',           defaultsPorRol: { ingeniero: true, propietario: false, operador: false } },
];

export function moduloIdValido(id: string): id is ModuloId {
  return (MODULO_IDS as readonly string[]).includes(id);
}
