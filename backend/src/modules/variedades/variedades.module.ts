import { Module } from '@nestjs/common';
import { VariedadesController } from './variedades.controller';
import { VariedadesService } from './variedades.service';

@Module({
  controllers: [VariedadesController],
  providers: [VariedadesService],
  exports: [VariedadesService],
})
export class VariedadesModule {}
