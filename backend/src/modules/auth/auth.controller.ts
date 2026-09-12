import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ActivarDto,
  ActualizarPerfilDto,
  CambiarPasswordDto,
  LoginDto,
  RefreshDto,
  RegistroDto,
} from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Usuario } from '../../common/decorators/usuario.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { UsuarioActual } from '../../common/types/usuario-actual';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.service.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.service.refresh(dto.refreshToken);
  }

  @Public()
  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  registro(@Body() dto: RegistroDto) {
    return this.service.registrar(dto);
  }

  @Public()
  @Get('invitacion/:token')
  verificarInvitacion(@Param('token') token: string) {
    return this.service.verificarTokenInvitacion(token);
  }

  @Public()
  @Post('activar')
  @HttpCode(HttpStatus.OK)
  activar(@Body() dto: ActivarDto) {
    return this.service.activarConToken(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Usuario() user: UsuarioActual) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  actualizarPerfil(@Usuario() user: UsuarioActual, @Body() dto: ActualizarPerfilDto) {
    return this.service.actualizarPerfil(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  cambiarPassword(@Usuario() user: UsuarioActual, @Body() dto: CambiarPasswordDto) {
    return this.service.cambiarPassword(user.id, dto.passwordActual, dto.passwordNueva);
  }

  /** Cambiar la cuenta activa (solo ingenieros con múltiples cuentas). */
  @UseGuards(JwtAuthGuard)
  @Post('switch-cuenta/:id')
  @HttpCode(HttpStatus.OK)
  switchCuenta(@Usuario() user: UsuarioActual, @Param('id', ParseUUIDPipe) cuentaId: string) {
    return this.service.switchCuenta(user.id, cuentaId);
  }
}
