import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import configuration, { type AppConfig } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PropietariosModule } from './modules/propietarios/propietarios.module';
import { CultivosModule } from './modules/cultivos/cultivos.module';
import { VariedadesModule } from './modules/variedades/variedades.module';
import { EstablecimientosModule } from './modules/establecimientos/establecimientos.module';
import { LotesModule } from './modules/lotes/lotes.module';
import { CampaniasModule } from './modules/campanias/campanias.module';
import { LotesCampaniaModule } from './modules/lotes-campania/lotes-campania.module';
import { LaboresModule } from './modules/labores/labores.module';
import { InsumosAplicadosModule } from './modules/insumos-aplicados/insumos-aplicados.module';
import { CalculosModule } from './modules/calculos/calculos.module';
import { LluviasModule } from './modules/lluvias/lluvias.module';
import { ClimaModule } from './modules/clima/clima.module';
import { PreciosModule } from './modules/precios/precios.module';
import { AsistenteModule } from './modules/asistente/asistente.module';
import { MonitoreosModule } from './modules/monitoreos/monitoreos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AlertasModule } from './modules/alertas/alertas.module';
import { InsumosModule } from './modules/insumos/insumos.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailModule } from './modules/email/email.module';
import { MiembrosModule } from './modules/miembros/miembros.module';
import { FacturacionModule } from './modules/facturacion/facturacion.module';
import { TokenizadasModule } from './modules/tokenizadas/tokenizadas.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SuperAdminGuard } from './common/guards/super-admin.guard';
import { RolPlataformaGuard } from './common/guards/rol-plataforma.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 30 },
      { name: 'long', ttl: 60_000 * 15, limit: 200 },
    ]),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRootAsync({
      useFactory: (cfg: ConfigService<AppConfig, true>) => [
        {
          rootPath: cfg.get('uploads', { infer: true }).dir,
          serveRoot: '/uploads',
          serveStaticOptions: { fallthrough: false, maxAge: '7d' },
        },
      ],
      inject: [ConfigService],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PropietariosModule,
    CultivosModule,
    VariedadesModule,
    EstablecimientosModule,
    LotesModule,
    CampaniasModule,
    LotesCampaniaModule,
    LaboresModule,
    InsumosAplicadosModule,
    CalculosModule,
    LluviasModule,
    ClimaModule,
    PreciosModule,
    AsistenteModule,
    MonitoreosModule,
    ReportesModule,
    AlertasModule,
    InsumosModule,
    EmailModule,
    AdminModule,
    MiembrosModule,
    FacturacionModule,
    TokenizadasModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SuperAdminGuard },
    { provide: APP_GUARD, useClass: RolPlataformaGuard },
  ],
})
export class AppModule {}
