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
import { PropietariosService } from './propietarios.service';
import { CambiarPasswordPropietarioDto, CrearPropietarioDto } from './propietarios.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';

@Controller('propietarios')
export class PropietariosController {
  constructor(private readonly service: PropietariosService) {}

  @Get()
  listar(@Usuario() user: UsuarioActual) {
    this.service.asegurarIngeniero(user.rolEnCuentaActiva);
    return this.service.listar(user.cuentaId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Usuario() user: UsuarioActual, @Body() dto: CrearPropietarioDto) {
    this.service.asegurarIngeniero(user.rolEnCuentaActiva);
    return this.service.crear(user.cuentaId, dto);
  }

  @Post(':usuarioId/cambiar-password')
  @HttpCode(HttpStatus.OK)
  cambiarPassword(
    @Usuario() user: UsuarioActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() dto: CambiarPasswordPropietarioDto,
  ) {
    this.service.asegurarIngeniero(user.rolEnCuentaActiva);
    return this.service.cambiarPassword(user.cuentaId, usuarioId, dto);
  }

  @Delete(':usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revocar(
    @Usuario() user: UsuarioActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ) {
    this.service.asegurarIngeniero(user.rolEnCuentaActiva);
    return this.service.revocarAcceso(user.cuentaId, usuarioId);
  }
}
