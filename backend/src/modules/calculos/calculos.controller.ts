import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CalculosService } from './calculos.service';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

@Controller('calculos')
export class CalculosController {
  constructor(private readonly service: CalculosService) {}

  @Get('lotes-campania/:id/resultado')
  resultadoLote(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.calcularResultadoLote(user.cuentaId, id);
  }

  @Get('campanias/:id/por-cultivo')
  porCultivo(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.agregarPorCultivo(user.cuentaId, id);
  }

  @Get('campanias/:id/por-establecimiento')
  porEstablecimiento(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.agregarPorEstablecimiento(user.cuentaId, id);
  }

  @Get('campanias/:id/resumen')
  resumenCampania(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.resumenCampania(user.cuentaId, id);
  }

  /** Ranking de lote-campañas. Filtros y orden por query string. */
  @Get('ranking')
  ranking(
    @Usuario() user: UsuarioActual,
    @Query('campaniaId') campaniaId?: string,
    @Query('cultivoId') cultivoId?: string,
    @Query('establecimientoId') establecimientoId?: string,
    @Query('ordenarPor') ordenarPor?: string,
    @Query('enfoque') enfoque?: string,
  ) {
    return this.service.rankingLotes(user.cuentaId, {
      campaniaId,
      cultivoId,
      establecimientoId,
      ordenarPor: ordenarPor as 'margen_neto' | 'margen_neto_ha' | 'rinde' | 'costo_total_ha' | 'ingreso_bruto' | undefined,
      enfoque: enfoque as 'productivo' | 'costos' | undefined,
    });
  }
}
