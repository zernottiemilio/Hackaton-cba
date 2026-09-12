import type { RolEnCuenta, RolGlobal, RolTokenizacion } from '@prisma/client';

export interface MembresiaResumen {
  cuentaId: string;
  cuentaNombre: string;
  rol: RolEnCuenta;
}

export interface UsuarioActual {
  id: string;
  email: string;
  nombre: string;
  rolGlobal: RolGlobal;
  /** Rol único del usuario en la plataforma Harvest.fi. Decide qué shell/rutas
   *  ve al hacer login (productor, inversor, admin_plataforma, acopio).
   *  Es null para usuarios legacy del MVP sin haber elegido rol Harvest todavía. */
  rolPlataforma: RolTokenizacion | null;
  /** Wallet Solana asociada al usuario (mock por ahora). */
  walletAddress: string | null;
  /** Cuenta actualmente activa en el JWT. Para propietarios siempre es la misma. */
  cuentaId: string;
  /** Rol del usuario en la cuenta activa. */
  rolEnCuentaActiva: RolEnCuenta;
  /** Módulos explícitamente permitidos en la cuenta activa. Vacío = usa defaults del rol. */
  modulosPermitidos: string[];
  /** Todas las cuentas a las que el usuario tiene acceso. */
  membresias: MembresiaResumen[];
  /** Si es true, el superadmin está viendo el sistema como otra cuenta. */
  impersonating?: boolean;
  /** Nombre de la cuenta que se está impersonando (para mostrar en UI). */
  impersonatingCuentaNombre?: string;
}
