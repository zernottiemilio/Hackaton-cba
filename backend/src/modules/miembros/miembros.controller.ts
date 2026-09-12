import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { MiembrosService } from './miembros.service';
import { ActualizarMiembroDto, InvitarMiembroDto } from './miembros.dto';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('miembros')
export class MiembrosController {
  constructor(
    private readonly service: MiembrosService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  listar(@Usuario() user: UsuarioActual) {
    return this.service.listar(user.cuentaId);
  }

  @Post('invitar')
  @HttpCode(HttpStatus.CREATED)
  async invitar(@Usuario() user: UsuarioActual, @Body() dto: InvitarMiembroDto) {
    this.service.asegurarPuedeGestionar(user.rolEnCuentaActiva);
    const cuenta = await this.prisma.cuenta.findUnique({ where: { id: user.cuentaId }, select: { nombre: true } });
    return this.service.invitar(user.cuentaId, cuenta?.nombre ?? 'tu cuenta', dto);
  }

  @Patch(':usuarioId')
  @HttpCode(HttpStatus.OK)
  actualizar(
    @Usuario() user: UsuarioActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() dto: ActualizarMiembroDto,
  ) {
    this.service.asegurarPuedeGestionar(user.rolEnCuentaActiva);
    return this.service.actualizar(user.cuentaId, usuarioId, dto);
  }

  @Delete(':usuarioId')
  @HttpCode(HttpStatus.OK)
  quitar(
    @Usuario() user: UsuarioActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ) {
    this.service.asegurarPuedeGestionar(user.rolEnCuentaActiva);
    return this.service.quitar(user.cuentaId, usuarioId, user.id);
  }

  @Post(':usuarioId/reenviar-invitacion')
  @HttpCode(HttpStatus.OK)
  async reenviar(
    @Usuario() user: UsuarioActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ) {
    this.service.asegurarPuedeGestionar(user.rolEnCuentaActiva);
    const cuenta = await this.prisma.cuenta.findUnique({ where: { id: user.cuentaId }, select: { nombre: true } });
    return this.service.reenviarInvitacion(user.cuentaId, cuenta?.nombre ?? 'tu cuenta', usuarioId);
  }
}
