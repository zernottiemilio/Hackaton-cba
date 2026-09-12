import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RolEnCuenta, RolGlobal } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { CrearPropietarioDto, CambiarPasswordPropietarioDto } from './propietarios.dto';

/**
 * Gestión de propietarios DENTRO de una cuenta.
 *
 * Flujo:
 *  - El ingeniero (logueado, con cuentaActivaId = X) crea un usuario propietario
 *    para X. La password queda generada (random) si el ingeniero no la pasa
 *    explícitamente, y se devuelve UNA SOLA VEZ en la respuesta para que el
 *    ingeniero se la copie y se la pase por WhatsApp.
 *  - El propietario hace login con esas credenciales y queda atado a esa cuenta
 *    única.
 *
 * Reglas:
 *  - Solo ingenieros pueden crear/borrar propietarios.
 *  - Si el email ya existe como usuario en otra cuenta, le agregamos una
 *    membresía a esta cuenta también (con rol propietario). No duplicamos
 *    usuario.
 *  - El listado solo muestra propietarios DE ESTA CUENTA.
 */
@Injectable()
export class PropietariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(cuentaId: string) {
    const membresias = await this.prisma.usuarioCuenta.findMany({
      where: { cuentaId, rol: RolEnCuenta.propietario, activo: true },
      include: { usuario: { select: { id: true, email: true, nombre: true, ultimoLogin: true, activo: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return membresias.map((m) => ({
      membresiaId: m.id,
      usuarioId: m.usuario.id,
      email: m.usuario.email,
      nombre: m.usuario.nombre,
      ultimoLogin: m.usuario.ultimoLogin,
      activo: m.usuario.activo && m.activo,
      creadoEn: m.createdAt,
    }));
  }

  async crear(cuentaId: string, dto: CrearPropietarioDto) {
    const email = dto.email.toLowerCase().trim();
    const password = dto.password ?? this.generarPasswordRandom();
    const passwordHash = await bcrypt.hash(password, 12);

    // ¿Existe ya un usuario con ese email?
    const existente = await this.prisma.usuario.findUnique({
      where: { email },
      include: { membresias: { where: { cuentaId } } },
    });

    if (existente) {
      // ¿Ya tiene membresía a esta cuenta?
      if (existente.membresias.length > 0) {
        throw new ConflictException('Ese email ya tiene acceso a esta cuenta');
      }
      // Le agregamos membresía como propietario. La password no se cambia.
      await this.prisma.usuarioCuenta.create({
        data: { usuarioId: existente.id, cuentaId, rol: RolEnCuenta.propietario },
      });
      return {
        membresiaId: '(existente)',
        usuarioId: existente.id,
        email: existente.email,
        nombre: existente.nombre,
        passwordGenerada: null,
        mensaje: 'Usuario ya existía. Le agregamos acceso a esta cuenta. Su contraseña no se modificó.',
      };
    }

    // Crear usuario nuevo + membresía en una transacción
    const { usuario, membresia } = await this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: {
          cuentaId,
          email,
          passwordHash,
          nombre: dto.nombre,
          rolGlobal: RolGlobal.propietario,
        },
      });
      const m = await tx.usuarioCuenta.create({
        data: { usuarioId: u.id, cuentaId, rol: RolEnCuenta.propietario },
      });
      return { usuario: u, membresia: m };
    });

    return {
      membresiaId: membresia.id,
      usuarioId: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      passwordGenerada: dto.password ? null : password,
      mensaje: dto.password
        ? 'Propietario creado con la contraseña que pasaste.'
        : 'Propietario creado. Copiá la contraseña y mandala por WhatsApp — no se vuelve a mostrar.',
    };
  }

  async cambiarPassword(cuentaId: string, usuarioId: string, dto: CambiarPasswordPropietarioDto) {
    const membresia = await this.prisma.usuarioCuenta.findFirst({
      where: { cuentaId, usuarioId, rol: RolEnCuenta.propietario, activo: true },
    });
    if (!membresia) throw new NotFoundException('Propietario no encontrado en esta cuenta');

    const password = dto.password ?? this.generarPasswordRandom();
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { passwordHash } });
    return { usuarioId, passwordGenerada: dto.password ? null : password };
  }

  async revocarAcceso(cuentaId: string, usuarioId: string) {
    const membresia = await this.prisma.usuarioCuenta.findFirst({
      where: { cuentaId, usuarioId, rol: RolEnCuenta.propietario },
    });
    if (!membresia) throw new NotFoundException('Propietario no encontrado en esta cuenta');

    // Solo desactivamos la membresía, no borramos el usuario (puede tener acceso a otras cuentas).
    await this.prisma.usuarioCuenta.update({
      where: { id: membresia.id },
      data: { activo: false },
    });

    // Si el usuario no tiene NINGUNA otra membresía activa, lo desactivamos también para limpieza.
    const otras = await this.prisma.usuarioCuenta.count({
      where: { usuarioId, activo: true },
    });
    if (otras === 0) {
      await this.prisma.usuario.update({ where: { id: usuarioId }, data: { activo: false } });
    }
  }

  /** Validador de rol para usar desde el controller. */
  asegurarIngeniero(rol: RolEnCuenta): void {
    if (rol !== RolEnCuenta.ingeniero) {
      throw new ForbiddenException('Solo el ingeniero puede gestionar propietarios');
    }
  }

  private generarPasswordRandom(): string {
    // 10 caracteres alfanuméricos sin ambiguos (0/O, 1/l/I)
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 10; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }
}
