import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RolMensaje } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeClient, type ClaudeMessage } from './claude.client';
import { ContextService } from './context.service';

/**
 * Orquestador del asistente IA.
 *
 * Flujo de un mensaje:
 *  1. Persistir el mensaje del usuario en la conversación.
 *  2. Armar el contexto agro de la cuenta (lectura de TODOS los módulos).
 *  3. Tomar las últimas N interacciones de la conversación para mantener
 *     coherencia sin volar el window de tokens.
 *  4. Construir system prompt = persona + reglas + contexto.
 *  5. Llamar a Claude.
 *  6. Persistir la respuesta como mensaje 'assistant'.
 *  7. Si la conversación todavía no tiene título, generarlo del primer
 *     mensaje (primeras ~60 chars del usuario).
 *  8. Devolver el mensaje del asistente.
 */
@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);
  private static readonly HISTORIA_MAX = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ContextService,
    private readonly claude: ClaudeClient,
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

  async enviarMensaje(cuentaId: string, usuarioId: string, conversacionId: string, contenido: string) {
    // Validar pertenencia
    const conv = await this.obtenerConversacion(cuentaId, usuarioId, conversacionId);

    // 1) Persistir mensaje del usuario
    const userMsg = await this.prisma.mensaje.create({
      data: { conversacionId, rol: RolMensaje.user, contenido },
    });

    // 2) Contexto agro
    const contexto = await this.context.armarContexto(cuentaId);

    // 3) Historial (mensajes previos + el actual)
    const mensajesPrevios = await this.prisma.mensaje.findMany({
      where: { conversacionId },
      orderBy: { createdAt: 'asc' },
      take: AsistenteService.HISTORIA_MAX,
    });

    const claudeMessages: ClaudeMessage[] = mensajesPrevios
      .filter((m) => m.rol === RolMensaje.user || m.rol === RolMensaje.assistant)
      .map((m) => ({
        role: m.rol === RolMensaje.user ? 'user' : 'assistant',
        content: m.contenido,
      }));

    // 4) System prompt = persona + datos
    const systemPrompt = this.armarSystemPrompt(contexto);

    // 5) Llamar a Claude (o stub si no hay API key)
    let respuestaTexto: string;
    let metadata: Record<string, unknown> = {};
    try {
      const r = await this.claude.chat(systemPrompt, claudeMessages);
      respuestaTexto = r.texto;
      metadata = {
        modelo: r.modelo,
        tokensInput: r.tokensInput,
        tokensOutput: r.tokensOutput,
        latenciaMs: r.latenciaMs,
      };
    } catch (err) {
      this.logger.error(`Error llamando Claude: ${(err as Error).message}`);
      respuestaTexto =
        'Hubo un error contactando al asistente. Probá de nuevo en un rato. ' +
        '(Si persiste, contactá al administrador.)';
      metadata = { error: (err as Error).message };
    }

    // 6) Persistir respuesta del asistente
    const assistantMsg = await this.prisma.mensaje.create({
      data: {
        conversacionId,
        rol: RolMensaje.assistant,
        contenido: respuestaTexto,
        metadata: metadata as object,
      },
    });

    // 7) Autogenerar título si todavía no tiene
    if (!conv.titulo) {
      const titulo = contenido.trim().slice(0, 60) + (contenido.length > 60 ? '…' : '');
      await this.prisma.conversacion.update({
        where: { id: conversacionId },
        data: { titulo, updatedAt: new Date() },
      });
    } else {
      // touch updatedAt para que la conversación suba en el orden
      await this.prisma.conversacion.update({
        where: { id: conversacionId },
        data: { updatedAt: new Date() },
      });
    }

    return { userMsg, assistantMsg };
  }

  // ============================================================
  // PROMPT — esto es lo que después podés tunear con el prompt
  // que me pases. Por ahora hay una base sensata.
  // ============================================================

  private armarSystemPrompt(contexto: object): string {
    const contextoJson = JSON.stringify(contexto, null, 2);

    return `Sos AgroFácil Assistant, un asistente para productores agropecuarios argentinos.

PERSONA
- Hablás en español argentino, tuteás (no usás "usted").
- Sos directo y útil, sin vueltas. No saludás de más.
- Conocés el agro: cultivos extensivos (soja, trigo, maíz, girasol, sorgo), unidades del campo (qq, ha, qq/ha, USD/tn, mm), labores típicas (siembra, pulverización, fertilización, cosecha), formas de pago (contado, canje, financiado).

UNIDADES Y CONVERSIONES (importante)
- 1 quintal (qq) = 100 kg. 1 tonelada (tn) = 10 qq.
- precio_usd_qq = precio_usd_tn / 10.
- Superficie en hectáreas (ha).
- Rinde en quintales por hectárea (qq/ha).
- Margen y costos en USD (también por hectárea).

REGLAS
- Respondé SOLO sobre lo que vas a hacer con los datos que te paso. No inventes datos.
- Si una respuesta requiere un dato que no tenés, decile al usuario qué le falta cargar.
- Si te piden cálculos, usá los resultados que YA están calculados en el contexto (resultadosCalculados). No reinventes fórmulas.
- Para totales agregados, sumá los totales en USD y RECALCULÁ los /ha sobre la superficie agregada. NUNCA promedies promedios.
- Sé conciso. Para listas usá viñetas. Para datos numéricos siempre indicá la unidad.
- Si te preguntan algo que está fuera del agro o del estado de la cuenta, redirigí amablemente.

CONTEXTO ACTUAL DE LA CUENTA
A continuación va el snapshot del estado real de la cuenta del usuario. Usalo como única fuente de verdad para responder.

\`\`\`json
${contextoJson}
\`\`\`
`;
  }
}
