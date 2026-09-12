import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, type RolPlataforma } from '@/stores/authStore';

interface Props {
  /** Roles autorizados. Si viene vacío, alcanza con estar autenticado. */
  roles?: RolPlataforma[];
  /** Si `true`, no requiere sesión — pero si hay usuario logueado con rol incorrecto, redirige. */
  publica?: boolean;
}

/**
 * Guard de ruta para el módulo Harvest.
 *
 *   <RutaHarvest publica />                    // pública, cualquiera pasa
 *   <RutaHarvest />                            // requiere auth
 *   <RutaHarvest roles={['productor']} />      // requiere auth + rol específico
 *   <RutaHarvest roles={['productor','inversor']} />  // cualquiera de los dos
 *
 * Si el usuario no está autenticado y la ruta lo requiere → redirige a
 * `/login` guardando el pathname actual para volver ahí después.
 * Si está autenticado con rol incorrecto → redirige a `/` (donde la home
 * disparcha según su rol).
 */
export function RutaHarvest({ roles, publica = false }: Props) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);

  if (publica) return <Outlet />;

  if (!isAuthenticated || !usuario) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && roles.length > 0) {
    const rol = usuario.rolPlataforma;
    if (!rol || !roles.includes(rol)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}
