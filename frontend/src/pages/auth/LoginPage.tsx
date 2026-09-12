import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { authService } from '@/services/authService';
import { useAuthStore, type UsuarioActual } from '@/stores/authStore';
import { extraerMensajeError } from '@/lib/apiClient';
import { HarvestLogo } from '@/modules/tokenizadas/components/brand/HarvestLogo';
import '@/modules/tokenizadas/styles/harvest-tokens.css';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
type FormData = z.infer<typeof schema>;

/**
 * LoginPage con identidad Harvest.fi (dark + verde `#2BE06A`).
 * Al login exitoso redirige según `usuario.rolPlataforma`:
 *   - productor / inversor → `/` (la home dispatchea según rol)
 *   - admin_plataforma     → `/revision-emisiones`
 *   - acopio               → `/acopio`
 *   - null (superadmin del MVP legacy) → `/admin-mvp`
 */
export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => authService.login(data.email, data.password),
    onSuccess: (res) => {
      setTokens(res.accessToken, res.refreshToken, res.usuario);
      toast.success(`Bienvenido, ${res.usuario.nombre}`);
      navigate(destinoSegunRol(res.usuario), { replace: true });
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  if (isAuthenticated && usuario) {
    return <Navigate to={destinoSegunRol(usuario)} replace />;
  }

  return (
    <div
      className="min-h-screen tk-scope flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--hv-bg)' }}
    >
      {/* Manchas verdes desenfocadas al estilo Harvest */}
      <div
        className="absolute -top-32 -right-32 rounded-full blur-3xl"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(43,224,106,0.14) 0%, transparent 65%)',
        }}
      />
      <div
        className="absolute -bottom-40 -left-40 rounded-full blur-3xl"
        style={{
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(10,107,18,0.20) 0%, transparent 65%)',
        }}
      />

      {/* Grid pattern muy sutil */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="relative w-full max-w-md"
      >
        {/* Card principal */}
        <div
          className="hv-glass hv-radial"
          style={{
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5), var(--hv-inset-top)',
          }}
        >
          {/* Logo + tagline */}
          <div className="flex flex-col items-center text-center mb-8">
            <HarvestLogo variant="lockup-vertical" size={40} animated tagline />
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div>
              <div
                className="hv-label"
                style={{ fontSize: 10, marginBottom: 6, textAlign: 'left' }}
              >
                Email
              </div>
              <input
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                {...register('email')}
                className="hv-mono"
                style={{
                  width: '100%',
                  background: 'var(--hv-bg-input)',
                  border: '1px solid var(--hv-border)',
                  color: 'var(--hv-text)',
                  fontSize: 14,
                  padding: '12px 14px',
                  borderRadius: 10,
                  letterSpacing: '0.01em',
                }}
              />
              {errors.email && (
                <p style={{ color: 'var(--hv-red-text)', fontSize: 12, marginTop: 6 }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div
                className="hv-label"
                style={{ fontSize: 10, marginBottom: 6, textAlign: 'left' }}
              >
                Contraseña
              </div>
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="hv-mono"
                style={{
                  width: '100%',
                  background: 'var(--hv-bg-input)',
                  border: '1px solid var(--hv-border)',
                  color: 'var(--hv-text)',
                  fontSize: 14,
                  padding: '12px 14px',
                  borderRadius: 10,
                  letterSpacing: '0.05em',
                }}
              />
              {errors.password && (
                <p style={{ color: 'var(--hv-red-text)', fontSize: 12, marginTop: 6 }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="hv-cta"
              style={{ width: '100%', padding: '13px', marginTop: 6 }}
            >
              {mutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '2px solid rgba(6,18,10,0.3)',
                      borderTopColor: 'var(--hv-bg-token)',
                      animation: 'hv-spin 700ms linear infinite',
                    }}
                  />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          {/* Credenciales demo */}
          <div
            className="mt-6 pt-6"
            style={{ borderTop: '1px solid var(--hv-border-subtle)' }}
          >
            <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>
              Cuentas demo
            </div>
            <div className="space-y-1.5" style={{ fontSize: 11 }}>
              <CredencialDemo
                rol="Productor"
                email="juan@productor.demo"
                password="agrofacil123"
              />
              <CredencialDemo
                rol="Inversor"
                email="carlos@inversor.demo"
                password="agrofacil123"
              />
              <CredencialDemo
                rol="Admin"
                email="admin@tokenizadas.demo"
                password="agrofacil123"
              />
            </div>
          </div>
        </div>

        <p
          className="hv-label-sm text-center mt-4"
          style={{ fontSize: 10 }}
        >
          Solana devnet · sin custodia intermedia
        </p>
      </motion.div>
    </div>
  );
}

function CredencialDemo({
  rol,
  email,
  password,
}: {
  rol: string;
  email: string;
  password: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span style={{ color: 'var(--hv-text-muted)', fontSize: 10, minWidth: 60 }}>{rol}</span>
      <span
        className="hv-mono"
        style={{
          color: 'var(--hv-text-2)',
          fontSize: 10,
          letterSpacing: '0.02em',
          flex: 1,
          textAlign: 'right',
        }}
      >
        {email} <span style={{ color: 'var(--hv-text-muted)' }}>/</span> {password}
      </span>
    </div>
  );
}

/**
 * Ruteo posterior al login según el rol Harvest del usuario.
 * Los superadmin del MVP viejo (sin rolPlataforma) van al legacy `/admin-mvp`.
 */
function destinoSegunRol(usuario: UsuarioActual): string {
  if (usuario.rolPlataforma === 'admin_plataforma') return '/revision-emisiones';
  if (usuario.rolPlataforma === 'acopio') return '/acopio';
  if (usuario.rolPlataforma === 'productor' || usuario.rolPlataforma === 'inversor') return '/';
  if (usuario.rolGlobal === 'superadmin') return '/admin-mvp';
  return '/';
}
