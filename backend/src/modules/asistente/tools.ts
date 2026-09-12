/**
 * Definición de las tools (acciones) que Claude puede ejecutar en nombre
 * del productor. Sigue el formato del Anthropic SDK Tool Use.
 *
 * Cada tool tiene:
 *  - name: identificador único, snake_case
 *  - description: para que el LLM sepa cuándo usarla. ESPECÍFICO, sin ambigüedad.
 *  - input_schema: JSON Schema de los parámetros.
 *
 * Convenciones:
 *  - El cuentaId no es parámetro: se toma del usuario autenticado en runtime.
 *  - Para referencias a entidades de la cuenta (establecimiento, lote, etc.)
 *    se usa el ID que el LLM saca del contexto inyectado al inicio.
 *  - Las tools de actualización son idempotentes y vuelven a leer la entidad
 *    antes de modificar.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
  // ============================================================
  // REGISTROS — lo más usado en el campo
  // ============================================================
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

  // ============================================================
  // ACTUALIZACIONES DEL LOTE-CAMPAÑA
  // ============================================================
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

  // ============================================================
  // CREACIÓN DE ENTIDADES BASE
  // ============================================================
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
