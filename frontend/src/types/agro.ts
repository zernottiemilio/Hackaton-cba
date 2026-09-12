// Tipos del dominio AgroFácil — espejan el shape de las respuestas del backend.

export type Tenencia = 'propio' | 'arrendado' | 'mixto';
export type UnidadArrendamiento = 'qq_ha' | 'usd_ha' | 'pct_produccion';
export type TipoCampania = 'fina' | 'gruesa';
export type TipoLabor = 'siembra' | 'pulverizacion' | 'fertilizacion' | 'cosecha' | 'otra';
export type Ejecutor = 'propio' | 'contratista';
export type FormaPago = 'contado' | 'canje' | 'financiado';
export type TipoInsumo = 'semilla' | 'fertilizante' | 'herbicida' | 'insecticida' | 'fungicida' | 'otro';

export interface Establecimiento {
  id: string;
  cuentaId: string;
  nombre: string;
  ubicacion: string | null;
  latitud: string | null;
  longitud: string | null;
  tenencia: Tenencia;
  superficieTotalHa: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { lotes: number };
  lotes?: Lote[];
}

export interface Lote {
  id: string;
  cuentaId: string;
  establecimientoId: string;
  nombre: string;
  superficieHa: string;
  tenencia: Tenencia | null;
  arrendamientoValor: string | null;
  arrendamientoUnidad: UnidadArrendamiento | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  establecimiento?: { id: string; nombre: string };
}

export interface Campania {
  id: string;
  cuentaId: string;
  nombre: string;
  tipo: TipoCampania;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { lotesCampania: number };
}

export interface Cultivo {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoteCampania {
  id: string;
  cuentaId: string;
  loteId: string;
  campaniaId: string;
  cultivoId: string;
  superficieSembradaHa: string;
  fechaSiembra: string | null;
  rindeEstimadoQqHa: string | null;
  rindeRealQqHa: string | null;
  precioGranoUsdTn: string | null;
  fechaCosecha: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  lote?: Lote & { establecimiento?: { id: string; nombre: string } };
  campania?: Campania;
  cultivo?: Cultivo;
  labores?: Labor[];
  insumosAplicados?: InsumoAplicado[];
}

export interface Labor {
  id: string;
  cuentaId: string;
  loteCampaniaId: string;
  tipo: TipoLabor;
  fecha: string;
  ejecutor: Ejecutor;
  costoTotalUsd: string | null;
  formaPago: FormaPago | null;
  nota: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InsumoAplicado {
  id: string;
  cuentaId: string;
  loteCampaniaId: string;
  tipo: TipoInsumo;
  producto: string;
  cantidad: string;
  unidad: string;
  costoTotalUsd: string;
  formaPago: FormaPago | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResultadoLote {
  loteCampaniaId: string;
  cultivo: string;
  lote: string;
  esProyeccion: boolean;
  superficieHa: string;
  rinde: string;
  rindeFuente: 'real' | 'estimado';
  precioGranoUsdTn: string;
  precioGranoUsdQq: string;
  ingresoBruto: string;
  costos: {
    insumos: string;
    labores: string;
    directo: string;
    arrendamiento: string;
    otros: string;
    total: string;
    totalHa: string;
  };
  margenes: {
    bruto: string;
    brutoHa: string;
    neto: string;
    netoHa: string;
    netoQqHa: string;
  };
  puntoEquilibrio: {
    rindeQqHa: string;
    margenSeguridadQq: string;
    lectura: string;
  };
}

export interface ResumenCampania {
  campaniaId: string;
  cantidadLotes: number;
  esProyeccion: boolean;
  totales: {
    superficieHa: string;
    ingresoBruto: string;
    costoTotal: string;
    margenNeto: string;
    ingresoBrutoHa: string;
    costoTotalHa: string;
    margenNetoHa: string;
  };
  porCultivo: AgregadoPorCultivo[];
}

export interface AgregadoPorCultivo {
  cultivoId: string;
  cultivoNombre: string;
  cantidadLotes: number;
  esProyeccion: boolean;
  superficieHa: string;
  ingresoBruto: string;
  costoTotal: string;
  margenNeto: string;
  ingresoBrutoHa: string;
  costoTotalHa: string;
  margenNetoHa: string;
}
