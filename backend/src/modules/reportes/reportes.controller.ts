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
} from '@nestjs/common';

import { ReportesService } from './reportes.service';
import { ComentarioReporteDto, CrearReporteDto } from './reportes.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  // -------- Endpoint público --------
  // NO requiere auth — el token UUID es la "credencial". Lo declaramos
  // antes de los rutas autenticadas para que el guard global lo respete
  // gracias al decorador @Public().

  @Public()
  @Get('publico/:token')
  obtenerPublico(@Param('token') token: string) {
    return this.service.obtenerPorToken(token);
  }

  // -------- Endpoints autenticados --------

  @Get()
  listar(@Usuario() user: UsuarioActual) {
    return this.service.listarPorCuenta(user.cuentaId);
  }

  @Get(':id')
  obtener(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtenerInterno(user.cuentaId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Usuario() user: UsuarioActual, @Body() dto: CrearReporteDto) {
    return this.service.crear(user, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revocar(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.revocar(user, id);
  }

  // -------- Comentarios --------

  @Get(':id/comentarios')
  listarComentarios(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.listarComentarios(user.cuentaId, id);
  }

  @Post(':id/comentarios')
  @HttpCode(HttpStatus.CREATED)
  comentar(
    @Usuario() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComentarioReporteDto,
  ) {
    return this.service.comentar(user, id, dto);
  }

  @Delete('comentarios/:comentarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarComentario(
    @Usuario() user: UsuarioActual,
    @Param('comentarioId', ParseUUIDPipe) comentarioId: string,
  ) {
    return this.service.eliminarComentario(user, comentarioId);
  }
}
