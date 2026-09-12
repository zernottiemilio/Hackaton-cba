/**
 * Definición de las tools (acciones) que Claude puede ejecutar según el rol
 * del usuario. Sigue el formato del Anthropic SDK Tool Use.
 *
 * Cada tool tiene:
 *  - name: identificador único, snake_case
 *  - description: para que el LLM sepa cuándo usarla. ESPECÍFICO, sin ambigüedad.
 *  - input_schema: JSON Schema de los parámetros.
 *
 * Convenciones:
 *  - El cuentaId/usuarioId no son parámetros: se toman del usuario autenticado.
 *  - Para referencias a entidades (establecimiento, lote, productor, etc.) se
 *    usa el ID que el LLM saca del contexto inyectado al inicio.
 *  - Las tools de actualización son idempotentes y vuelven a leer la entidad
 *    antes de modificar.
 *  - `toolsParaRol(rol)` elige el set correcto según `Usuario.rolPlataforma`.
 */

import type { RolTokenizacion } from '@prisma/client';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================================
// TOOLS PARA EL PRODUCTOR — operación diaria del campo
// ============================================================
export const TOOLS_PRODUCTOR: ToolDefinition[] = [
  {
    name: 'registrar_lluvia',
    description:
      'Registra los milímetros de lluvia caídos en una fecha. Usalo cuando el productor diga ' +
      'cuánto llovió ("ayer cayeron 12mm", "registramos 30mm en el lote 4 esta semana"). ' +
      'Si no especifica establecimiento, se registra a nivel cuenta. Si dice "hoy", usá la fecha actual.',
    input_schema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        mm: { type: 'number', description: 'Milímetros caídos. Debe ser >= 0.' },
        establecimientoId: {
          type: 'string',
          description: 'ID UUID del establecimiento (opcional). Si se omite, queda a nivel cuenta.',
        },
        nota: { type: 'string', description: 'Observación libre (opcional).' },
      },
      required: ['fecha', 'mm'],
    },
  },
  {
    name: 'registrar_labor',
    description:
      'Registra una labor realizada en un lote-campaña. Usalo cuando el productor describa una ' +
      'tarea hecha ("ayer pulverizaron el lote 4", "se sembró soja"). El ID del lote-campaña ' +
      'lo sacás del contexto. La fecha por defecto es hoy si no la dice.',
    input_schema: {
      type: 'object',
      properties: {
        loteCampaniaId: { type: 'string', description: 'UUID del lote-campaña.' },
        tipo: {
          type: 'string',
          enum: ['siembra', 'pulverizacion', 'fertilizacion', 'cosecha', 'otra'],
        },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        ejecutor: {
          type: 'string',
          enum: ['propio', 'contratista'],
          description: 'Quién ejecutó la labor.',
        },
        costoTotalUsd: { type: 'number', description: 'Costo total en USD (opcional).' },
        formaPago: { type: 'string', enum: ['contado', 'canje', 'financiado'] },
        nota: { type: 'string' },
      },
      required: ['loteCampaniaId', 'tipo', 'fecha'],
    },
  },
  {
    name: 'registrar_insumo',
    description:
      'Registra un insumo aplicado en un lote-campaña. Usalo cuando el productor describa una ' +
      'aplicación de producto ("apliqué 3 lt/ha de glifosato", "se fertilizó con 80 kg/ha de urea"). ' +
      'IMPORTANTE: el costoTotalUsd es el costo TOTAL en USD para esa cantidad, no el precio unitario.',
    input_schema: {
      type: 'object',
      properties: {
        loteCampaniaId: { type: 'string' },
        tipo: {
          type: 'string',
          enum: ['semilla', 'fertilizante', 'herbicida', 'insecticida', 'fungicida', 'otro'],
        },
        producto: { type: 'string', description: 'Nombre comercial o principio activo.' },
        cantidad: { type: 'number', description: 'Cantidad total aplicada (no por hectárea).' },
        unidad: { type: 'string', description: 'lt, kg, bolsa, sem/ha, gr/ha, etc.' },
        costoTotalUsd: { type: 'number' },
        formaPago: { type: 'string', enum: ['contado', 'canje', 'financiado'] },
      },
      required: ['loteCampaniaId', 'tipo', 'producto', 'cantidad', 'unidad', 'costoTotalUsd'],
    },
  },
  {
    name: 'actualizar_lote_campania',
    description:
      'Actualiza datos del lote-campaña: rinde estimado, rinde real (post-cosecha), precio del ' +
      'grano (USD/tn), fechas de siembra o cosecha. Usalo cuando el productor diga ' +
      '"cosechamos a 38 qq/ha", "el precio cayó a 280", "sembramos el 15 de noviembre". ' +
      'SOLO modifica los campos que el productor menciona explícitamente.',
    input_schema: {
      type: 'object',
      properties: {
        loteCampaniaId: { type: 'string' },
        rindeEstimadoQqHa: { type: 'number', description: 'Rinde estimado en qq/ha (antes de cosecha).' },
        rindeRealQqHa: { type: 'number', description: 'Rinde real medido en cosecha (qq/ha).' },
        precioGranoUsdTn: {
          type: 'number',
          description: 'Precio en USD por TONELADA (no por quintal). Típico granos: 100-500 USD/tn.',
        },
        fechaSiembra: { type: 'string', description: 'YYYY-MM-DD' },
        fechaCosecha: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['loteCampaniaId'],
    },
  },
  {
    name: 'crear_lote',
    description:
      'Crea un nuevo lote dentro de un establecimiento. Usalo cuando el productor diga ' +
      '"agregá el lote 5 de 40 hectáreas en Campo Norte". Necesita el establecimientoId ' +
      'que sacás del contexto.',
    input_schema: {
      type: 'object',
      properties: {
        establecimientoId: { type: 'string' },
        nombre: { type: 'string' },
        superficieHa: { type: 'number' },
        tenencia: { type: 'string', enum: ['propio', 'arrendado', 'mixto'] },
        arrendamientoValor: { type: 'number' },
        arrendamientoUnidad: { type: 'string', enum: ['qq_ha', 'usd_ha', 'pct_produccion'] },
      },
      required: ['establecimientoId', 'nombre', 'superficieHa'],
    },
  },
  {
    name: 'asignar_cultivo_a_campania',
    description:
      'Asigna un cultivo a un lote dentro de una campaña (crea un lote_campania). Necesita ' +
      'campaniaId, loteId y cultivoId que sacás del contexto.catalogo.cultivos o ' +
      'contexto.lotes y contexto.campaniasActivas.',
    input_schema: {
      type: 'object',
      properties: {
        loteId: { type: 'string' },
        campaniaId: { type: 'string' },
        cultivoId: { type: 'string' },
        superficieSembradaHa: { type: 'number' },
        fechaSiembra: { type: 'string' },
        rindeEstimadoQqHa: { type: 'number' },
        precioGranoUsdTn: { type: 'number' },
      },
      required: ['loteId', 'campaniaId', 'cultivoId', 'superficieSembradaHa'],
    },
  },
];

// ============================================================
// TOOLS PARA EL INVERSOR — asesoría para decidir en qué invertir
// ============================================================
export const TOOLS_INVERSOR: ToolDefinition[] = [
  {
    name: 'consultar_historial_productor',
    description:
      'Trae el histórico de campañas ya liquidadas de un productor + KPIs (retorno promedio, ' +
      'cumplimiento de fechas, cumplimiento de rinde). Usalo SIEMPRE que el inversor pregunte ' +
      'sobre un productor específico o cuando estés comparando campañas del marketplace: sin ' +
      'este dato no podés justificar una recomendación. El productorId lo sacás del contexto ' +
      '(marketplace[].productor.id o portfolio[].tokenizacion.productor.id).',
    input_schema: {
      type: 'object',
      properties: {
        productorId: { type: 'string', description: 'UUID del productor.' },
      },
      required: ['productorId'],
    },
  },
  {
    name: 'buscar_campanas_marketplace',
    description:
      'Lista campañas actualmente abiertas en el marketplace con filtros. Usalo cuando el ' +
      'inversor pida ver oportunidades ("qué hay para invertir en soja", "campañas de córdoba ' +
      'con garantías"). Por defecto ordena por "cierra_pronto".',
    input_schema: {
      type: 'object',
      properties: {
        cultivo: { type: 'string', description: 'Nombre del cultivo (soja, maíz, trigo, girasol).' },
        provincia: { type: 'string' },
        soloConGarantias: { type: 'boolean' },
        orden: {
          type: 'string',
          enum: ['cierra_pronto', 'mayor_descuento', 'menor_riesgo', 'recientes'],
        },
      },
      required: [],
    },
  },
  {
    name: 'simular_retorno',
    description:
      'Simula el retorno del inversor en 3 escenarios (pesimista/base/optimista) para una ' +
      'tokenización dada del marketplace. Devuelve USDC estimado + retorno % en cada escenario. ' +
      'Usalo cuando el inversor pregunte cuánto podría ganar o cuál es el riesgo. La ' +
      'tokenizacionId la sacás del contexto.marketplace.',
    input_schema: {
      type: 'object',
      properties: {
        tokenizacionId: { type: 'string' },
        cantidadTokens: {
          type: 'number',
          description: 'Cuántos tokens (toneladas) simular. Default: 100.',
        },
      },
      required: ['tokenizacionId'],
    },
  },
];

// ============================================================
// TOOLS PARA EL ADMIN — operaciones y métricas globales
// ============================================================
export const TOOLS_ADMIN: ToolDefinition[] = [
  {
    name: 'listar_campanas_revision',
    description:
      'Devuelve las campañas en estado `en_revision` esperando aprobación del admin, con detalle ' +
      'del productor, cultivo, monto objetivo, garantías y antigüedad de la solicitud. Usalo ' +
      'cuando el admin pregunte "qué tengo pendiente" o "cuáles reviso primero".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'resumen_comisiones',
    description:
      'Resumen de comisiones cobradas por la plataforma en el período pedido (default: mes actual). ' +
      'Devuelve total, cantidad de operaciones, breakdown por tipo (compra inversor vs cobro ' +
      'productor). Usalo cuando el admin pregunte por ingresos / facturación.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'YYYY-MM-DD (opcional).' },
        hasta: { type: 'string', description: 'YYYY-MM-DD (opcional).' },
      },
      required: [],
    },
  },
];

// ============================================================
// TOOLS PARA ACOPIO — placeholder, sin acciones habilitadas todavía
// ============================================================
export const TOOLS_ACOPIO: ToolDefinition[] = [];

/**
 * Devuelve las tools disponibles para el rol activo. Si el usuario no tiene
 * rol de plataforma seteado (típico ingeniero legacy), asumimos productor
 * porque es el flujo AgroFácil original.
 */
export function toolsParaRol(rol: RolTokenizacion | null | undefined): ToolDefinition[] {
  switch (rol) {
    case 'inversor':
      return TOOLS_INVERSOR;
    case 'admin_plataforma':
      return TOOLS_ADMIN;
    case 'acopio':
      return TOOLS_ACOPIO;
    case 'productor':
    default:
      return TOOLS_PRODUCTOR;
  }
}

// Backwards-compat: el executor viejo importaba `TOOLS`. Lo dejamos apuntando
// al set de productor para que nada roto suba hasta el rebuild.
export const TOOLS = TOOLS_PRODUCTOR;
