import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { rutaInicialPorRol, useAuthStore, type RolPlataforma } from '@/stores/authStore';
import { AppLayout } from './AppLayout';

interface RutaProtegidaProps {
  /**
   * Si se pasan roles, solo esos pueden entrar. El resto se redirige a su
   * ruta inicial con un aviso. Si no se pasa nada, cualquier autenticado entra.
   *
   * `'sin-rol'` matchea usuarios con `rolPlataforma === null` (legacy MVP).
   */
  roles?: Array<RolPlataforma | 'sin-rol'>;
}

export function RutaProtegida({ roles }: RutaProtegidaProps = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);

  const rolPermitido = (() => {
    if (!roles) return true;
    if (!usuario) return false;
    if (usuario.rolPlataforma === null) return roles.includes('sin-rol');
    return roles.includes(usuario.rolPlataforma);
  })();

  useEffect(() => {
    if (isAuthenticated && usuario && !rolPermitido) {
      toast.error('Esa sección no está disponible para tu perfil');
    }
  }, [isAuthenticated, usuario, rolPermitido]);

  if (!isAuthenticated || !usuario) return <Navigate to="/login" replace />;
  if (!rolPermitido) return <Navigate to={rutaInicialPorRol(usuario.rolPlataforma)} replace />;

  return <AppLayout />;
}

/** Alias semántico para rutas que declaran explícitamente sus roles. */
export function RutaPorRol(props: { roles: Array<RolPlataforma | 'sin-rol'> }) {
  return <RutaProtegida roles={props.roles} />;
}
