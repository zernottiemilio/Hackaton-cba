import { SetMetadata } from '@nestjs/common';
import type { RolTokenizacion } from '@prisma/client';

export const ROL_PLATAFORMA_KEY = 'rolPlataforma';

/**
 * Marca un endpoint como accesible solo por usuarios con uno de los roles
 * indicados. Se enforcea en RolPlataformaGuard.
 *
 * Ejemplos:
 *   @RolPlataforma('productor')
 *   @RolPlataforma('inversor')
 *   @RolPlataforma('productor', 'inversor')  // cualquiera de los dos
 *
 * Sin esta anotación el endpoint queda abierto a cualquier rol autenticado.
 */
export const RolPlataforma = (...roles: RolTokenizacion[]) =>
  SetMetadata(ROL_PLATAFORMA_KEY, roles);
