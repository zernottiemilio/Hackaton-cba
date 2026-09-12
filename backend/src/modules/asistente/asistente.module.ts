import { Module } from '@nestjs/common';
import { AsistenteController } from './asistente.controller';
import { AsistenteService } from './asistente.service';
import { ContextService } from './context.service';
import { ClaudeClient } from './claude.client';
import { ClimaModule } from '../clima/clima.module';
import { CalculosModule } from '../calculos/calculos.module';

@Module({
  imports: [ClimaModule, CalculosModule],
  controllers: [AsistenteController],
  providers: [AsistenteService, ContextService, ClaudeClient],
  exports: [AsistenteService],
})
export class AsistenteModule {}
