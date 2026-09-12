import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PreciosService } from './precios.service';

/**
 * Endpoints públicos con precios reales de la pizarra Rosario.
 * Fuente: granos.ar (Consiagro / BCR). Cacheado en memoria.
 */
@Controller('precios')
export class PreciosController {
  constructor(private readonly service: PreciosService) {}

  /** Precios del día por grano en ARS/tn y USD/tn + variación vs rueda anterior. */
  @Public()
  @Get('pizarra')
  pizarra() {
    return this.service.pizarraActual();
  }

  /** Serie histórica diaria (USD/tn por grano). Default 30 días, máx 365. */
  @Public()
  @Get('pizarra/historico')
  pizarraHistorico(@Query('dias') dias?: string) {
    const n = dias ? Number(dias) : 30;
    return this.service.pizarraHistorico(Number.isFinite(n) ? n : 30);
  }
}
