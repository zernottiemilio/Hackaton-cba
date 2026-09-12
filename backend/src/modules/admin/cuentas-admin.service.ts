import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { CrearCuentaDto } from './dto/admin.dto';

const INVITACION_TTL_DIAS = 7;

@Injectable()
export class CuentasAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /// Listado con contadores: usuarios activos por cuenta y establecimientos.
  async listar() {
    const cuentas = await this.prisma.cuenta.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { membresias: true, establecimientos: true } },
      },
    });
    return cuentas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      emailContacto: c.emailContacto,
      telefono: c.telefono,
      activo: c.activo,
      createdAt: c.createdAt,
      usuarios: c._count.membresias,
      establecimientos: c._count.establecimientos,
    }));
  }

  async detalle(id: string) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id },
      include: {
        membresias: {
          where: { activo: true },
          include: { usuario: { select: { id: true, nombre: true, email: true, activo: true, ultimoLogin: true } } },
        },
        _count: { select: { establecimientos: true, campanias: true } },
      },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return cuenta;
  }

  /// Crea una Cuenta. Si vienen `ingenieroEmail` + `ingenieroNombre`, también crea
  /// el usuario invitado (con hash sentinela) y manda el email de activación.
  async crear(dto: CrearCuentaDto) {
    if (dto.ingenieroEmail) {
      const existente = await this.prisma.usuario.findUnique({ where: { email: dto.ingenieroEmail } });
      if (existente) throw new ConflictException('Ya existe un usuario con ese email');
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.create({
        data: {
          nombre: dto.nombreCuenta,
          emailContacto: dto.emailContacto ?? dto.ingenieroEmail,
          telefono: dto.telefono,
        },
      });

      let invitacion: { usuarioId: string; email: string; nombre: string; token: string } | null = null;

      if (dto.ingenieroEmail && dto.ingenieroNombre) {
        const sentinelHash = await generarHashSentinela();
        const usuario = await tx.usuario.create({
          data: {
            cuentaId: cuenta.id,
            email: dto.ingenieroEmail,
            passwordHash: sentinelHash,
            nombre: dto.ingenieroNombre,
            rolGlobal: 'ingeniero',
            activo: true,
          },
        });
        await tx.usuarioCuenta.create({
          data: { usuarioId: usuario.id, cuentaId: cuenta.id, rol: 'ingeniero' },
        });
        const token = generarToken();
        await tx.tokenInvitacion.create({
          data: {
            usuarioId: usuario.id,
            token,
            expiraEn: addDias(new Date(), INVITACION_TTL_DIAS),
          },
        });
        invitacion = { usuarioId: usuario.id, email: usuario.email, nombre: usuario.nombre, token };
      }

      return { cuenta, invitacion };
    });

    if (resultado.invitacion) {
      const link = `${this.config.get<string>('appPublicUrl')}/activar/${resultado.invitacion.token}`;
      await this.email.enviarInvitacion({
        to: resultado.invitacion.email,
        nombre: resultado.invitacion.nombre,
        cuentaNombre: resultado.cuenta.nombre,
        linkActivacion: link,
      });
    }

    return {
      cuenta: resultado.cuenta,
      invitacionEnviada: !!resultado.invitacion,
    };
  }

  async actualizar(id: string, dto: { nombre?: string; emailContacto?: string; telefono?: string }) {
    const data: { nombre?: string; emailContacto?: string | null; telefono?: string | null } = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.emailContacto !== undefined) data.emailContacto = dto.emailContacto || null;
    if (dto.telefono !== undefined) data.telefono = dto.telefono || null;

    const cuenta = await this.prisma.cuenta.update({ where: { id }, data }).catch(() => null);
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return cuenta;
  }

  async activar(id: string) {
    const cuenta = await this.prisma.cuenta.update({
      where: { id },
      data: { activo: true },
    }).catch(() => null);
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return cuenta;
  }

  async desactivar(id: string) {
    const cuenta = await this.prisma.cuenta.update({
      where: { id },
      data: { activo: false },
    }).catch(() => null);
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return cuenta;
  }
}

/// Genera un hash bcrypt impossible-to-match para usuarios todavía no activados.
async function generarHashSentinela(): Promise<string> {
  const noise = crypto.randomBytes(48).toString('hex');
  return bcrypt.hash(noise, 12);
}

function generarToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function addDias(d: Date, dias: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
}
