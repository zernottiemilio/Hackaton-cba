import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/** Mensaje en el formato que espera Claude (rol + contenido). */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  texto: string;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  latenciaMs: number;
}

/**
 * Cliente para la API de Claude (Anthropic).
 *
 * Si la env ANTHROPIC_API_KEY no está seteada, devuelve una respuesta
 * stub que explica que falta configuración. Esto permite probar la UI
 * y la persistencia de conversaciones sin gastar tokens.
 *
 * Modelo por defecto: claude-sonnet-4-6 (rápido y potente para chat agro).
 * Para conversaciones largas o análisis complejos podés usar opus-4-7
 * desde el ANTHROPIC_MODEL env var.
 */
@Injectable()
export class ClaudeClient {
  private readonly logger = new Logger(ClaudeClient.name);
  private client?: Anthropic;
  private modelo: string;

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

  async chat(systemPrompt: string, messages: ClaudeMessage[]): Promise<ClaudeResponse> {
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
      };
    }

    const res = await this.client.messages.create({
      model: this.modelo,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const texto = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    return {
      texto,
      modelo: res.model,
      tokensInput: res.usage.input_tokens,
      tokensOutput: res.usage.output_tokens,
      latenciaMs: Date.now() - inicio,
    };
  }
}
