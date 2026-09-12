import { Module } from '@nestjs/common';
import { InsumosAplicadosController } from './insumos-aplicados.controller';
import { InsumosAplicadosService } from './insumos-aplicados.service';
import { InsumosModule } from '../insumos/insumos.module';

@Module({
  imports: [InsumosModule],
  controllers: [InsumosAplicadosController],
  providers: [InsumosAplicadosService],
  exports: [InsumosAplicadosService],
})
export class InsumosAplicadosModule {}
