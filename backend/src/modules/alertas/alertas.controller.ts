import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { AlertasService } from './alertas.service';
import { CrearAlertaDto } from './alertas.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

@Controller('alertas')
export class AlertasController {
  constructor(private readonly service: AlertasService) {}

  @Get()
  listar(
    @Usuario() user: UsuarioActual,
    @Query('soloNoLeidas') soloNoLeidas?: string,
  ) {
    return this.service.listar(user, soloNoLeidas === 'true');
  }

  @Get('conteo')
  contar(@Usuario() user: UsuarioActual) {
    return this.service.contarNoLeidas(user).then((noLeidas) => ({ noLeidas }));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Usuario() user: UsuarioActual, @Body() dto: CrearAlertaDto) {
    return this.service.crear(user, dto);
  }

  @Post(':id/leer')
  @HttpCode(HttpStatus.OK)
  marcarLeida(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.marcarLeida(user, id);
  }

  @Post('leer-todas')
  @HttpCode(HttpStatus.OK)
  marcarTodasLeidas(@Usuario() user: UsuarioActual) {
    return this.service.marcarTodasLeidas(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(user, id);
  }
}
