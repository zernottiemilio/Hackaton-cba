import { resolve } from 'path';

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  corsOrigin: string;
  appPublicUrl: string;
  jwt: {
    secret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  groq: {
    apiKey: string;
    modelo: string;
  };
  email: {
    resendApiKey: string;
    from: string;
    replyTo: string;
  };
  uploads: {
    /** Carpeta absoluta donde caen los archivos subidos. En dev: ./uploads. En Railway: /data/uploads (volume montado). */
    dir: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:5173',
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    modelo: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'AgroFácil <onboarding@resend.dev>',
    replyTo: process.env.EMAIL_REPLY_TO ?? '',
  },
  uploads: {
    dir: resolve(process.env.UPLOADS_DIR ?? './uploads'),
  },
});
