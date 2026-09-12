import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { rutaInicialPorTipo, useAuthStore, type TipoUsuario } from '@/stores/authStore';
import { AppLayout } from './AppLayout';

interface RutaProtegidaProps {
  /**
   * Si se pasan tipos, solo esos roles pueden entrar. El resto se redirige a
   * su ruta inicial con un aviso. Si no se pasa nada, cualquier autenticado entra.
   */
  tipos?: TipoUsuario[];
}

export function RutaProtegida({ tipos }: RutaProtegidaProps = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);

  const rolPermitido = !tipos || (usuario ? tipos.includes(usuario.tipo) : false);

  useEffect(() => {
    if (isAuthenticated && usuario && !rolPermitido) {
      toast.error('Esa sección no está disponible para tu perfil');
    }
  }, [isAuthenticated, usuario, rolPermitido]);

  if (!isAuthenticated || !usuario) return <Navigate to="/login" replace />;
  if (!rolPermitido) return <Navigate to={rutaInicialPorTipo(usuario.tipo)} replace />;

  // Si hay children route (Outlet), lo renderiza el AppLayout dentro.
  // El AppLayout ya usa <Outlet /> internamente.
  return <AppLayout />;
}

/**
 * Alias semántico para rutas que declaran explícitamente sus roles.
 * Equivalente a `<RutaProtegida tipos={[...]} />`.
 */
export function RutaPorRol(props: { tipos: TipoUsuario[] }) {
  return <RutaProtegida tipos={props.tipos} />;
}
