import { Module } from '@nestjs/common';
import { MonitoreosController } from './monitoreos.controller';
import { MonitoreosService } from './monitoreos.service';

@Module({
  controllers: [MonitoreosController],
  providers: [MonitoreosService],
  exports: [MonitoreosService],
})
export class MonitoreosModule {}
