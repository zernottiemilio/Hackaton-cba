import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CuentasAdminService } from './cuentas-admin.service';
import { UsuariosAdminService } from './usuarios-admin.service';
import { InvitacionesAdminService } from './invitaciones-admin.service';
import { AnalyticsAdminService } from './analytics-admin.service';
import { AuthService } from '../auth/auth.service';
import { SuperAdmin } from '../../common/decorators/super-admin.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Usuario } from '../../common/decorators/usuario.decorator';
import type { UsuarioActual } from '../../common/types/usuario-actual';
import {
  ActualizarCuentaDto,
  ActualizarMembresiaDto,
  ActualizarUsuarioDto,
  CrearCuentaDto,
  InvitarUsuarioDto,
} from './dto/admin.dto';

/// Panel del dueño de la plataforma. TODOS los endpoints requieren rolGlobal=superadmin.
@SuperAdmin()
@UseGuards(SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly cuentas: CuentasAdminService,
    private readonly usuarios: UsuariosAdminService,
    private readonly invitaciones: InvitacionesAdminService,
    private readonly analytics: AnalyticsAdminService,
    private readonly auth: AuthService,
  ) {}

  // ===== Métricas globales =====

  @Get('metricas')
  metricasGlobales() {
    return this.analytics.global();
  }

  // ===== Cuentas (organizaciones) =====

  @Get('cuentas')
  listarCuentas() {
    return this.cuentas.listar();
  }

  @Post('cuentas')
  @HttpCode(HttpStatus.CREATED)
  crearCuenta(@Body() dto: CrearCuentaDto) {
    return this.cuentas.crear(dto);
  }

  @Get('cuentas/:id')
  detalleCuenta(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.detalle(id);
  }

  @Get('cuentas/:id/analytics')
  analyticsDeCuenta(@Param('id', ParseUUIDPipe) id: string) {
    return this.analytics.cuenta(id);
  }

  @Patch('cuentas/:id')
  @HttpCode(HttpStatus.OK)
  actualizarCuenta(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarCuentaDto) {
    return this.cuentas.actualizar(id, dto);
  }

  @Patch('cuentas/:id/activar')
  @HttpCode(HttpStatus.OK)
  activarCuenta(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.activar(id);
  }

  @Patch('cuentas/:id/desactivar')
  @HttpCode(HttpStatus.OK)
  desactivarCuenta(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.desactivar(id);
  }

  // ===== Impersonación =====

  /// Devuelve un par de tokens con `impersonating=true` para que el superadmin
  /// vea el sistema como si fuera la cuenta target.
  @Post('impersonar/:cuentaId')
  @HttpCode(HttpStatus.OK)
  impersonar(
    @Usuario() user: UsuarioActual,
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
  ) {
    return this.auth.impersonar(user.id, cuentaId);
  }

  // ===== Usuarios e invitaciones =====

  @Get('usuarios')
  listarUsuarios() {
    return this.usuarios.listar();
  }

  @Post('usuarios/invitar')
  @HttpCode(HttpStatus.CREATED)
  invitarUsuario(@Body() dto: InvitarUsuarioDto) {
    return this.usuarios.invitar(dto);
  }

  @Patch('usuarios/:id')
  @HttpCode(HttpStatus.OK)
  actualizarUsuario(
    @Usuario() solicitante: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.usuarios.actualizar(id, solicitante.id, dto);
  }

  @Post('usuarios/:id/reenviar-invitacion')
  @HttpCode(HttpStatus.OK)
  reenviarInvitacion(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.reenviarInvitacion(id);
  }

  @Patch('usuarios/:id/activar')
  @HttpCode(HttpStatus.OK)
  activarUsuario(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.activar(id);
  }

  @Patch('usuarios/:id/desactivar')
  @HttpCode(HttpStatus.OK)
  desactivarUsuario(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.desactivar(id);
  }

  @Delete('usuarios/:id')
  @HttpCode(HttpStatus.OK)
  eliminarUsuario(@Usuario() solicitante: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.eliminar(id, solicitante.id);
  }

  @Patch('usuarios/:usuarioId/membresias/:cuentaId')
  @HttpCode(HttpStatus.OK)
  actualizarMembresia(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
    @Body() dto: ActualizarMembresiaDto,
  ) {
    return this.usuarios.actualizarMembresia(usuarioId, cuentaId, dto.rol);
  }

  @Delete('usuarios/:usuarioId/membresias/:cuentaId')
  @HttpCode(HttpStatus.OK)
  quitarMembresia(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
  ) {
    return this.usuarios.quitarMembresia(usuarioId, cuentaId);
  }

  // ===== Invitaciones (tokens) =====

  @Get('invitaciones')
  listarInvitaciones() {
    return this.invitaciones.listar();
  }

  @Delete('invitaciones/:id')
  @HttpCode(HttpStatus.OK)
  cancelarInvitacion(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitaciones.cancelar(id);
  }
}
