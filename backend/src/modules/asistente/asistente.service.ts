import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, RolMensaje } from '@prisma/client';
import { promises as fs } from 'fs';
import { extname } from 'path';

import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeClient, type ClaudeMessage, type ImagenAdjunta } from './claude.client';
import { ContextService } from './context.service';
import { ToolExecutorService } from './tool-executor.service';

type AdjuntoMensaje =
  | { tipo: 'image'; url: string; mediaType: ImagenAdjunta['mediaType']; nombre: string }
  | { tipo: 'audio'; url: string; mediaType: string; nombre: string };

/**
 * Orquestador del asistente IA agronómico.
 *
 * Flujo de un mensaje:
 *  1. Persistir el mensaje del usuario.
 *  2. Armar contexto agro de la cuenta (lectura de TODOS los módulos).
 *  3. Tomar últimos N mensajes para mantener coherencia.
 *  4. System prompt = identidad agronómica + capacidades + contexto.
 *  5. Llamar a Claude con tools habilitadas (el modelo puede ejecutar
 *     acciones como registrar lluvia, labor, insumo, actualizar rinde, etc.).
 *  6. Persistir respuesta + metadata (tool calls usadas).
 *  7. Autogenerar título si no había.
 */
@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);
  private static readonly HISTORIA_MAX = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ContextService,
    private readonly claude: ClaudeClient,
    private readonly toolExecutor: ToolExecutorService,
  ) {}

  async listarConversaciones(cuentaId: string, usuarioId: string) {
    return this.prisma.conversacion.findMany({
      where: { cuentaId, usuarioId, activo: true },
      include: { _count: { select: { mensajes: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async obtenerConversacion(cuentaId: string, usuarioId: string, id: string) {
    const c = await this.prisma.conversacion.findFirst({
      where: { id, cuentaId, usuarioId, activo: true },
      include: { mensajes: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) throw new NotFoundException(`Conversación ${id} no encontrada`);
    return c;
  }

  async crearConversacion(cuentaId: string, usuarioId: string, titulo?: string) {
    return this.prisma.conversacion.create({
      data: { cuentaId, usuarioId, titulo },
    });
  }

  async renombrarConversacion(cuentaId: string, usuarioId: string, id: string, titulo: string) {
    const c = await this.obtenerConversacion(cuentaId, usuarioId, id);
    return this.prisma.conversacion.update({
      where: { id: c.id },
      data: { titulo },
    });
  }

  async eliminarConversacion(cuentaId: string, usuarioId: string, id: string) {
    await this.obtenerConversacion(cuentaId, usuarioId, id);
    await this.prisma.conversacion.update({ where: { id }, data: { activo: false } });
  }

  async enviarMensaje(
    cuentaId: string,
    usuarioId: string,
    conversacionId: string,
    contenido: string,
    archivosImagen: Express.Multer.File[] = [],
    archivoAudio?: Express.Multer.File,
  ) {
    const conv = await this.obtenerConversacion(cuentaId, usuarioId, conversacionId);

    // 1) Procesar adjuntos: leer cada imagen una vez en buffer para reusar
    // (URL guardada en metadata + base64 para Claude).
    const adjuntos: AdjuntoMensaje[] = [];
    const imagenesParaClaude: ImagenAdjunta[] = [];

    for (const file of archivosImagen) {
      try {
        const buffer = await fs.readFile(file.path);
        const dataBase64 = buffer.toString('base64');
        const mediaType = this.mediaTypeDesdeExtension(file.filename);
        adjuntos.push({
          tipo: 'image',
          url: `/uploads/asistente/${file.filename}`,
          mediaType,
          nombre: file.originalname,
        });
        imagenesParaClaude.push({ mediaType, dataBase64 });
      } catch (err) {
        this.logger.error(`No pude leer la imagen ${file.path}: ${(err as Error).message}`);
      }
    }

    // El audio se guarda como adjunto reproducible. Claude no entiende
    // audio nativo, la transcripción ya viene en `contenido` desde el
    // cliente (Web Speech API), así que sólo lo persistimos.
    if (archivoAudio) {
      adjuntos.push({
        tipo: 'audio',
        url: `/uploads/asistente/${archivoAudio.filename}`,
        mediaType: archivoAudio.mimetype || 'audio/webm',
        nombre: archivoAudio.originalname,
      });
    }

    // 2) Mensaje del usuario en DB (con adjuntos en metadata)
    const userMsg = await this.prisma.mensaje.create({
      data: {
        conversacionId,
        rol: RolMensaje.user,
        contenido,
        metadata: adjuntos.length > 0 ? ({ adjuntos } as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // 3) Contexto agro
    const contexto = await this.context.armarContexto(cuentaId);

    // 4) Historial — para mensajes previos no recuperamos imágenes
    // (sólo el último ya las tiene desde el path actual)
    const mensajesPrevios = await this.prisma.mensaje.findMany({
      where: { conversacionId, id: { not: userMsg.id } },
      orderBy: { createdAt: 'asc' },
      take: AsistenteService.HISTORIA_MAX - 1,
    });

    const claudeMessages: ClaudeMessage[] = mensajesPrevios
      .filter((m) => m.rol === RolMensaje.user || m.rol === RolMensaje.assistant)
      .map((m) => ({
        role: m.rol === RolMensaje.user ? 'user' : 'assistant',
        content: m.contenido,
      }));

    // 5) Agregar el mensaje recién creado CON sus imágenes
    const placeholder =
      imagenesParaClaude.length > 0 ? 'Mirá esto.' :
      archivoAudio ? '(El productor mandó una nota de voz pero no se pudo transcribir.)' : '';
    claudeMessages.push({
      role: 'user',
      content: contenido || placeholder,
      imagenes: imagenesParaClaude.length > 0 ? imagenesParaClaude : undefined,
    });

    // 6) System prompt
    const systemPrompt = this.armarSystemPrompt(contexto);

    // 7) Claude con tool use loop
    let respuestaTexto: string;
    let metadata: Record<string, unknown> = {};
    try {
      const r = await this.claude.run(
        systemPrompt,
        claudeMessages,
        async (toolName, input) => this.toolExecutor.execute(toolName, input, { cuentaId }),
      );
      respuestaTexto = r.texto || '(El asistente ejecutó acciones pero no devolvió texto. Recargá la página para ver los cambios.)';
      metadata = {
        modelo: r.modelo,
        tokensInput: r.tokensInput,
        tokensOutput: r.tokensOutput,
        latenciaMs: r.latenciaMs,
        toolCalls: r.toolCalls,
      };
    } catch (err) {
      this.logger.error(`Error llamando Claude: ${(err as Error).message}`);
      respuestaTexto =
        'Hubo un error contactando al asistente. Probá de nuevo en un rato. ' +
        '(Si persiste, contactá al administrador.)';
      metadata = { error: (err as Error).message };
    }

    // 8) Mensaje del asistente
    const assistantMsg = await this.prisma.mensaje.create({
      data: {
        conversacionId,
        rol: RolMensaje.assistant,
        contenido: respuestaTexto,
        metadata: metadata as object,
      },
    });

    // 9) Título
    if (!conv.titulo) {
      const baseTitulo = contenido.trim() || (adjuntos.length > 0 ? `Imagen — ${adjuntos[0].nombre}` : 'Conversación');
      const titulo = baseTitulo.slice(0, 60) + (baseTitulo.length > 60 ? '…' : '');
      await this.prisma.conversacion.update({
        where: { id: conversacionId },
        data: { titulo, updatedAt: new Date() },
      });
    } else {
      await this.prisma.conversacion.update({
        where: { id: conversacionId },
        data: { updatedAt: new Date() },
      });
    }

    return { userMsg, assistantMsg };
  }

  // ============================================================
  // SYSTEM PROMPT — agente agronómico de AgroFácil
  // Basado en AgroFacil_Prompt_Agente_Agronomico.docx v1.0
  // ============================================================

  private mediaTypeDesdeExtension(filename: string): ImagenAdjunta['mediaType'] {
    const ext = extname(filename).toLowerCase();
    switch (ext) {
      case '.png':  return 'image/png';
      case '.webp': return 'image/webp';
      case '.gif':  return 'image/gif';
      default:      return 'image/jpeg';
    }
  }

  private armarSystemPrompt(contexto: object): string {
    const contextoJson = JSON.stringify(contexto, null, 2);
    const fechaHoy = new Date().toISOString().slice(0, 10);

    return `# IDENTIDAD
Sos el agrónomo de AgroFácil: un ingeniero agrónomo virtual especializado en
cultivos extensivos de Argentina, sobre todo trigo, soja y maíz. Asistís a
productores de la zona núcleo en el diagnóstico de problemas de cultivo, en
la orientación sobre su manejo, y también ejecutás acciones administrativas
en la app cuando el productor te lo pide (registrar lluvias, labores, insumos,
actualizar rindes, etc.). Tu conocimiento es profundo, pero tu rol es
ORIENTAR, no reemplazar al profesional matriculado.

# QUÉ HACÉS
- Diagnosticás enfermedades, plagas, malezas y deficiencias nutricionales a
  partir de la descripción del productor y/o de fotos.
- Distinguís causas bióticas (hongos, bacterias, virus, insectos) de
  abióticas (clima, nutrición, fitotoxicidad, suelo).
- Orientás sobre manejo: cultural, biológico y, cuando corresponde, químico.
- Promovés manejo integrado (MIP) y rotación de modos de acción para prevenir
  resistencia.
- EJECUTÁS acciones administrativas en la app a pedido del productor usando
  las tools disponibles (ver sección CAPACIDADES DE GESTIÓN).
- Analizás los datos cargados en la cuenta (costos, márgenes, lluvias,
  rindes, clima) y das insights útiles para la toma de decisiones.

# REGLAS INNEGOCIABLES
1. NO emitís recetas. En Argentina la aplicación de fitosanitarios requiere
   receta agronómica firmada por un ingeniero agrónomo matriculado. Cerrá
   toda recomendación química derivando al productor a su agrónomo
   matriculado para la receta y la decisión final.
2. EL MARBETE MANDA. La dosis, el período de carencia, el de reingreso y las
   condiciones legales de uso están en el marbete del producto y en el
   registro vigente de SENASA. Indicá siempre que esa es la fuente oficial a
   verificar.
3. NO tenés datos en vivo. No accedés a internet ni al registro de SENASA.
   Por lo tanto: nunca afirmes que un producto está registrado hoy, no
   inventes números de registro ni marcas comerciales como si fueran un dato
   cierto, y no des dosis exactas presentadas como oficiales. Trabajá por
   PRINCIPIO ACTIVO y da rangos orientativos, aclarando que deben confirmarse
   en el marbete vigente. Recordá que las registraciones cambian (hay activos
   que se restringen o prohíben) y que tu conocimiento tiene una fecha de corte.
4. ANTE LA DUDA, DERIVÁ. Si el diagnóstico no es claro con la información
   disponible, decilo, ofrecé los diagnósticos diferenciales y recomendá
   confirmación a campo por el agrónomo o por análisis de laboratorio.
5. NO INVENTES. Si no sabés o no estás seguro, decilo. Una incertidumbre
   honesta vale más que un dato falso, sobre todo tratándose de químicos.
6. SEGURIDAD Y AMBIENTE. Cuando sugieras control químico, recordá el uso de
   EPP, el respeto de las distancias de aplicación a zonas pobladas y cursos
   de agua (regulación provincial), las condiciones climáticas (viento,
   deriva, temperatura) y los períodos de carencia y reingreso. Los valores
   específicos, al marbete y a la normativa local.
7. MANTENÉ EL FOCO. Respondés temas agronómicos del cultivo y de gestión de
   la app. Si te preguntan otra cosa, redirigí con amabilidad.
8. CONFIRMÁ ANTES DE EJECUTAR ACCIONES IRREVERSIBLES O AMBIGUAS. Si la pedida
   no es clara ("registrá una lluvia"), preguntá lo mínimo para ejecutar bien.
   Si es clara y tenés los datos ("registrá 12mm de hoy"), ejecutá directo y
   confirmá brevemente al productor.

# CAPACIDADES DE GESTIÓN (TOOLS)
Tenés acceso a las siguientes acciones para ejecutar a pedido del productor:

- registrar_lluvia: para anotar mm de un día en un establecimiento.
- registrar_labor: para anotar una labor (siembra, pulverización, etc.) en
  un lote-campaña.
- registrar_insumo: para anotar un insumo aplicado (producto, cantidad,
  unidad, costo) en un lote-campaña.
- actualizar_lote_campania: para corregir rinde estimado, rinde real,
  precio del grano (USD/tn), fecha de siembra o cosecha.
- crear_lote: para agregar un nuevo lote a un establecimiento.
- asignar_cultivo_a_campania: para asignar un lote a una campaña con un
  cultivo (crea un lote_campania).

Para usarlas, sacá los IDs (establecimientoId, loteId, loteCampaniaId,
cultivoId, campaniaId) del CONTEXTO inyectado más abajo. Si el productor
te dice un nombre ("el lote 4", "soja"), buscá el ID en el contexto.

REGLA DE PRECIO DEL GRANO: si te dictan un precio mayor a 1000 USD/tn,
asumí que se confundieron de unidad (pesos o por quintal) y pedí
confirmación antes de actualizar. Los granos típicos están entre 100 y 500
USD/tn.

# CÓMO DIAGNOSTICÁS
Antes de concluir, asegurate de tener el contexto mínimo. Si falta,
preguntá de forma breve y concreta:
- Cultivo y estadio fenológico.
- Zona o provincia.
- Síntomas: qué se ve, en qué parte de la planta, color y forma.
- Distribución en el lote (focos, bordes, generalizado) y velocidad de
  avance.
- Condiciones recientes: lluvias, temperatura, cultivo antecesor, últimas
  labores.

Si recibís una foto, describí primero lo que observás; si no alcanza para
concluir, pedí otro ángulo o más detalle. Razoná del síntoma a la causa,
priorizando lo más probable para ese cultivo, zona y momento.

# FORMATO DE RESPUESTA
Adaptate a la pregunta. Si es simple, respondé corto. Cuando hagas un
diagnóstico, usá esta estructura:
1. Diagnóstico probable — qué es y tu nivel de confianza (alto / medio / bajo).
2. Diferenciales — otras causas a descartar.
3. Manejo recomendado — opciones culturales, biológicas y, si corresponde,
   químicas.
4. Control químico (orientativo) — principio(s) activo(s) y grupo de
   resistencia. Aclarando que la elección final, la dosis y la receta las
   define el agrónomo matriculado según el marbete vigente.
5. Precauciones — seguridad, ambiente y regulación a verificar localmente.
6. Próximo paso — qué confirmar y por qué conviene la consulta profesional.

Cuando ejecutes una acción administrativa (tool), confirmá en una línea:
"Listo: registré 12 mm para hoy en Campo Norte." Sin formalismos.

# CONTEXTO DE LA APP
La fecha de hoy es ${fechaHoy}. A continuación va el snapshot completo del
estado real de la cuenta del productor (establecimientos, lotes, campañas
activas, lotes en campaña con sus rindes/precios/resultados calculados,
últimas labores, últimos insumos aplicados, lluvias de los últimos 90 días
con su origen — manual o de Open-Meteo —, y clima actual + pronóstico 5
días si hay coordenadas cargadas).

Usalo como única fuente de verdad para responder y para sacar los IDs que
necesitan las tools.

\`\`\`json
${contextoJson}
\`\`\`

# TONO
Hablás claro, directo y en argentino (voseo). Sos del campo: práctico y sin
vueltas, sin tecnicismos innecesarios pero preciso cuando hace falta.
Honesto con lo que no se sabe.`;
  }
}
