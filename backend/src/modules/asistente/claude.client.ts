import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { TOOLS, type ToolDefinition } from './tools';

/**
 * Cliente LLM del asistente.
 *
 * El nombre `ClaudeClient` es histórico (arrancó con Anthropic, migró a Groq
 * y ahora corre contra OpenAI gpt-4o-mini). Los tipos exportados
 * (`ClaudeMessage`, `ClaudeRunResult`, `ToolExecutor`, `ImagenAdjunta`) se
 * conservan para no forzar el rename en toda la cadena
 * (`AsistenteService`, `ToolExecutorService`).
 *
 * Soporte multimodal: gpt-4o-mini acepta imágenes por URL o base64. Cuando
 * el usuario adjunta una foto, la mandamos como `image_url` con data URL.
 *
 * Tool use: formato OpenAI Chat Completions (`type: 'function'`).
 */

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

/** Convierte nuestro `ToolDefinition` al formato Chat Completions. */
function toOpenAITool(t: ToolDefinition): OpenAI.Chat.Completions.ChatCompletionTool {
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
  private client?: OpenAI;
  private modelo: string;
  private static readonly MAX_ITERACIONES = 5;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY') ?? process.env.OPENAI_API_KEY;
    this.modelo = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    if (apiKey && apiKey.length > 10) {
      this.client = new OpenAI({ apiKey });
      this.logger.log(`LLM inicializado (OpenAI · ${this.modelo})`);
    } else {
      this.logger.warn(
        'OPENAI_API_KEY no configurada — el asistente devolverá respuestas stub. Setealá en Railway y redeploy.',
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
          'El asistente IA todavía no está configurado en este entorno (falta `OPENAI_API_KEY`). ' +
          'Avisale al admin para activarlo. Mientras tanto podés ver el resto del sistema sin problemas.',
        modelo: 'stub',
        tokensInput: 0,
        tokensOutput: 0,
        latenciaMs: Date.now() - inicio,
        toolCalls: [],
      };
    }

    const conversacion: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map<OpenAI.Chat.Completions.ChatCompletionMessageParam>((m) => {
        if (m.role === 'user' && m.imagenes && m.imagenes.length > 0) {
          const bloques: OpenAI.Chat.Completions.ChatCompletionContentPart[] = m.imagenes.map((img) => ({
            type: 'image_url',
            image_url: {
              url: `data:${img.mediaType};base64,${img.dataBase64}`,
            },
          }));
          if (m.content.trim()) {
            bloques.unshift({ type: 'text', text: m.content });
          }
          return { role: 'user', content: bloques };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const openAITools =
      toolsHabilitadas.length > 0 ? toolsHabilitadas.map(toOpenAITool) : undefined;

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
        ...(openAITools ? { tools: openAITools, tool_choice: 'auto' as const } : {}),
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
      // historial. Requerido para que OpenAI acepte los tool responses.
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
