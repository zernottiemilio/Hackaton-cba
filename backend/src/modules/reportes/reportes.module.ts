import { Module } from '@nestjs/common';
import { CalculosModule } from '../calculos/calculos.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [CalculosModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
