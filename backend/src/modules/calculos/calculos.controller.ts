import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
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

  @Get('campanias/:id/resumen')
  resumenCampania(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.resumenCampania(user.cuentaId, id);
  }
}
