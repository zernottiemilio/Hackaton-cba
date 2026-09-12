import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS } from './tools';

/** Una imagen adjunta a un mensaje user. */
export interface ImagenAdjunta {
  /** image/jpeg, image/png, image/webp, image/gif */
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Datos en base64 sin el prefijo "data:". */
  dataBase64: string;
}

/** Mensaje en el formato que espera Claude. Soporta texto + imágenes. */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Opcional, solo para role=user. Si tiene items, el contenido se envía como bloques multimodales. */
  imagenes?: ImagenAdjunta[];
}

export interface ClaudeRunResult {
  texto: string;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  latenciaMs: number;
  toolCalls: Array<{ name: string; input: unknown; resultado: unknown }>;
}

/** Función que ejecuta una tool. Inyectada desde AsistenteService. */
export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<{ ok: true; resultado: unknown } | { ok: false; error: string }>;

/**
 * Cliente para Claude con soporte de tool use.
 *
 * Loop:
 *  1. Envía mensaje + tools al modelo.
 *  2. Si stop_reason === 'tool_use', extrae cada tool_use block, ejecuta
 *     vía el executor, arma los tool_result y vuelve a llamar.
 *  3. Cuando stop_reason === 'end_turn', devuelve el texto final.
 *
 * Hasta 5 iteraciones por seguridad.
 */
@Injectable()
export class ClaudeClient {
  private readonly logger = new Logger(ClaudeClient.name);
  private client?: Anthropic;
  private modelo: string;
  private static readonly MAX_ITERACIONES = 5;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('anthropic.apiKey');
    this.modelo = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
    if (apiKey && apiKey.length > 10) {
      this.client = new Anthropic({ apiKey });
      this.logger.log(`ClaudeClient inicializado con modelo ${this.modelo}`);
    } else {
      this.logger.warn('ANTHROPIC_API_KEY no configurada — ClaudeClient devolverá respuestas stub');
    }
  }

  get estaConfigurado(): boolean {
    return !!this.client;
  }

  async run(
    systemPrompt: string,
    messages: ClaudeMessage[],
    executor: ToolExecutor,
  ): Promise<ClaudeRunResult> {
    const inicio = Date.now();

    if (!this.client) {
      return {
        texto:
          'El asistente IA todavía no está configurado en este entorno (falta `ANTHROPIC_API_KEY`). ' +
          'Avisame al admin para activarlo. Mientras tanto podés ver el resto del sistema sin problemas.',
        modelo: 'stub',
        tokensInput: 0,
        tokensOutput: 0,
        latenciaMs: Date.now() - inicio,
        toolCalls: [],
      };
    }

    const conversacion: Anthropic.MessageParam[] = messages.map((m) => {
      // Si es un user con imágenes, mandamos content como array de bloques.
      if (m.role === 'user' && m.imagenes && m.imagenes.length > 0) {
        const bloques: Anthropic.ContentBlockParam[] = m.imagenes.map((img) => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType,
            data: img.dataBase64,
          },
        }));
        if (m.content.trim()) {
          bloques.push({ type: 'text', text: m.content });
        }
        return { role: 'user', content: bloques };
      }
      return { role: m.role, content: m.content };
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let modeloRespuesta = this.modelo;
    const toolCalls: ClaudeRunResult['toolCalls'] = [];
    let textoFinal = '';

    for (let iter = 0; iter < ClaudeClient.MAX_ITERACIONES; iter++) {
      const res = await this.client.messages.create({
        model: this.modelo,
        max_tokens: 2048,
        system: systemPrompt,
        messages: conversacion,
        tools: TOOLS as unknown as Anthropic.Tool[],
      });

      totalInputTokens += res.usage.input_tokens;
      totalOutputTokens += res.usage.output_tokens;
      modeloRespuesta = res.model;

      const textoBloques = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map((c) => c.text);
      textoFinal = textoBloques.join('\n');

      if (res.stop_reason !== 'tool_use') break;

      const toolUseBlocks = res.content.filter(
        (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use',
      );
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tb of toolUseBlocks) {
        const resultado = await executor(tb.name, (tb.input ?? {}) as Record<string, unknown>);
        toolCalls.push({ name: tb.name, input: tb.input, resultado });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: JSON.stringify(resultado),
          is_error: !resultado.ok,
        });
      }

      conversacion.push({ role: 'assistant', content: res.content });
      conversacion.push({ role: 'user', content: toolResults });
    }

    return {
      texto: textoFinal,
      modelo: modeloRespuesta,
      tokensInput: totalInputTokens,
      tokensOutput: totalOutputTokens,
      latenciaMs: Date.now() - inicio,
      toolCalls,
    };
  }
}
