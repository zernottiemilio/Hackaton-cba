import { Module } from '@nestjs/common';
import { MiembrosController } from './miembros.controller';
import { MiembrosService } from './miembros.service';

@Module({
  controllers: [MiembrosController],
  providers: [MiembrosService],
})
export class MiembrosModule {}
