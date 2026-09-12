import { Module } from '@nestjs/common';
import { AsistenteController } from './asistente.controller';
import { AsistenteService } from './asistente.service';
import { ContextService } from './context.service';
import { ClaudeClient } from './claude.client';
import { ToolExecutorService } from './tool-executor.service';
import { ClimaModule } from '../clima/clima.module';
import { CalculosModule } from '../calculos/calculos.module';
import { LluviasModule } from '../lluvias/lluvias.module';
import { LaboresModule } from '../labores/labores.module';
import { InsumosAplicadosModule } from '../insumos-aplicados/insumos-aplicados.module';
import { LotesModule } from '../lotes/lotes.module';
import { LotesCampaniaModule } from '../lotes-campania/lotes-campania.module';

@Module({
  imports: [
    ClimaModule,
    CalculosModule,
    LluviasModule,
    LaboresModule,
    InsumosAplicadosModule,
    LotesModule,
    LotesCampaniaModule,
  ],
  controllers: [AsistenteController],
  providers: [AsistenteService, ContextService, ClaudeClient, ToolExecutorService],
  exports: [AsistenteService],
})
export class AsistenteModule {}
