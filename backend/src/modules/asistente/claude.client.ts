import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

import { TOOLS, type ToolDefinition } from './tools';

/**
 * Cliente LLM del asistente.
 *
 * En origen se llamaba `ClaudeClient` porque el asistente corría contra
 * Anthropic. Migramos a Groq (Llama 3.3 70b) para bajar costo a cero — el
 * SDK de Groq es compatible con el formato OpenAI Chat Completions, así que
 * el mapeo de tools es el estándar `type: 'function'`.
 *
 * El nombre de la clase y los tipos exportados se mantienen para no forzar
 * el rename en toda la cadena de imports (`AsistenteService`, `ToolExecutorService`).
 *
 * Diferencias vs la versión Anthropic:
 *  - Sin visión: `messages[].imagenes` se ignora en el request (Groq no
 *    soporta multimodal en Llama). Se loguea un warning y el modelo recibe
 *    solo el texto + un aviso ("hay una imagen adjunta").
 *  - Tool use format: `tools: [{ type: 'function', function: { ... } }]` y
 *    `tool_calls[]` en el message del assistant.
 *  - Stop reasons: 'tool_calls' vs Anthropic 'tool_use'.
 */

/** Una imagen adjunta a un mensaje user (ignorada por Groq — se conserva la interfaz para no romper callers). */
export interface ImagenAdjunta {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  dataBase64: string;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
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

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<{ ok: true; resultado: unknown } | { ok: false; error: string }>;

/** Convierte nuestro `ToolDefinition` al formato OpenAI/Groq. */
function toGroqTool(t: ToolDefinition): Groq.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  };
}

@Injectable()
export class ClaudeClient {
  private readonly logger = new Logger(ClaudeClient.name);
  private client?: Groq;
  private modelo: string;
  private static readonly MAX_ITERACIONES = 5;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GROQ_API_KEY') ?? process.env.GROQ_API_KEY;
    this.modelo = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    if (apiKey && apiKey.length > 10) {
      this.client = new Groq({ apiKey });
      this.logger.log(`LLM inicializado (Groq · ${this.modelo})`);
    } else {
      this.logger.warn(
        'GROQ_API_KEY no configurada — el asistente devolverá respuestas stub. Setealá en Railway y redeploy.',
      );
    }
  }

  get estaConfigurado(): boolean {
    return !!this.client;
  }

  async run(
    systemPrompt: string,
    messages: ClaudeMessage[],
    executor: ToolExecutor,
    toolsOverride?: ToolDefinition[],
  ): Promise<ClaudeRunResult> {
    const toolsHabilitadas = toolsOverride ?? TOOLS;
    const inicio = Date.now();

    if (!this.client) {
      return {
        texto:
          'El asistente IA todavía no está configurado en este entorno (falta `GROQ_API_KEY`). ' +
          'Avisale al admin para activarlo. Mientras tanto podés ver el resto del sistema sin problemas.',
        modelo: 'stub',
        tokensInput: 0,
        tokensOutput: 0,
        latenciaMs: Date.now() - inicio,
        toolCalls: [],
      };
    }

    // Adaptamos nuestros mensajes al formato OpenAI. Las imágenes las
    // descartamos con warning — Groq (Llama 3.3) es sólo texto.
    const conversacion: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => {
        if (m.imagenes && m.imagenes.length > 0) {
          this.logger.warn(
            `Se ignoraron ${m.imagenes.length} imagen(es) en un mensaje: Groq no soporta visión.`,
          );
          const nota = ` [Nota interna: el usuario adjuntó ${m.imagenes.length} imagen(es) que este modelo no puede procesar. Pedile que describa lo que ve o que use el flujo de carga por foto separado.]`;
          return { role: m.role, content: (m.content || '') + nota };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const groqTools =
      toolsHabilitadas.length > 0 ? toolsHabilitadas.map(toGroqTool) : undefined;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let modeloRespuesta = this.modelo;
    const toolCalls: ClaudeRunResult['toolCalls'] = [];
    let textoFinal = '';

    for (let iter = 0; iter < ClaudeClient.MAX_ITERACIONES; iter++) {
      const res = await this.client.chat.completions.create({
        model: this.modelo,
        max_tokens: 2048,
        messages: conversacion,
        ...(groqTools ? { tools: groqTools, tool_choice: 'auto' as const } : {}),
      });

      totalInputTokens += res.usage?.prompt_tokens ?? 0;
      totalOutputTokens += res.usage?.completion_tokens ?? 0;
      modeloRespuesta = res.model;

      const choice = res.choices[0];
      const message = choice.message;
      textoFinal = message.content ?? '';

      const pedidosTool = message.tool_calls ?? [];
      if (choice.finish_reason !== 'tool_calls' || pedidosTool.length === 0) break;

      // Empujamos el message del assistant tal cual (con los tool_calls) al
      // historial. Es requerido para que Groq acepte los tool responses.
      conversacion.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: pedidosTool,
      });

      for (const tc of pedidosTool) {
        if (tc.type !== 'function') continue;
        let input: Record<string, unknown> = {};
        try {
          input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch (err) {
          this.logger.warn(
            `Argumentos JSON inválidos para tool ${tc.function.name}: ${(err as Error).message}`,
          );
          input = {};
        }
        const resultado = await executor(tc.function.name, input);
        toolCalls.push({ name: tc.function.name, input, resultado });
        conversacion.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(resultado),
        });
      }
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
