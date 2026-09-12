import { Module } from '@nestjs/common';
import { InsumosAplicadosController } from './insumos-aplicados.controller';
import { InsumosAplicadosService } from './insumos-aplicados.service';

@Module({
  controllers: [InsumosAplicadosController],
  providers: [InsumosAplicadosService],
  exports: [InsumosAplicadosService],
})
export class InsumosAplicadosModule {}
