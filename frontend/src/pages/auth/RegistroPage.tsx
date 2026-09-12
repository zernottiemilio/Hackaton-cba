import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Sprout, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoLockup } from '@/components/layout/Logo';
import { authService } from '@/services/authService';
import { useAuthStore, rutaInicialPorTipo } from '@/stores/authStore';
import { extraerMensajeError } from '@/lib/apiClient';

type Tipo = 'propietario' | 'inversor';

const schemaBase = z.object({
  nombre: z.string().trim().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  nombreCuenta: z.string().trim().optional(),
});
type FormData = z.infer<typeof schemaBase>;

export function RegistroPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);

  const [tipo, setTipo] = useState<Tipo | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(
      schemaBase.refine(
        (d) => tipo === 'inversor' || (d.nombreCuenta && d.nombreCuenta.length > 0),
        { message: 'Nombre del campo o empresa requerido', path: ['nombreCuenta'] },
      ),
    ),
    defaultValues: { nombre: '', email: '', password: '', nombreCuenta: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      authService.registro({
        tipo: tipo!,
        nombre: data.nombre,
        email: data.email,
        password: data.password,
        nombreCuenta: tipo === 'propietario' ? data.nombreCuenta : undefined,
      }),
    onSuccess: (res) => {
      setTokens(res.accessToken, res.refreshToken, res.usuario);
      toast.success(`Cuenta creada. Bienvenido, ${res.usuario.nombre}`);
      navigate(rutaInicialPorTipo(res.usuario.tipo), { replace: true });
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  if (isAuthenticated && usuario) return <Navigate to={rutaInicialPorTipo(usuario.tipo)} replace />;

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div
        className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
        style={{ background: 'radial-gradient(circle, #047C00 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="relative w-full max-w-xl"
      >
        <div className="glass rounded-2xl shadow-lift p-8">
          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <LogoLockup size={42} animated />
            <p className="text-sm text-muted-foreground">Crear una cuenta</p>
          </div>

          {tipo === null ? (
            <>
              <h2 className="text-lg font-semibold text-center mb-1">¿Cómo vas a usar AgroFácil?</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Elegí uno. Podés cambiar más adelante.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTipo('propietario')}
                  className="group text-left p-5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sprout className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Tengo un campo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Gestiono mis campañas y publico una parte de mi producción para financiarme.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTipo('inversor')}
                  className="group text-left p-5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Quiero invertir</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Compro producción a futuro de campos argentinos.
                  </p>
                </button>
              </div>

              <p className="text-xs text-center text-muted-foreground mt-6 pt-5 border-t border-border">
                ¿Ya tenés cuenta?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Ingresá
                </Link>
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setTipo(null)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Cambiar tipo
              </button>

              <div className="mb-5 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
                {tipo === 'propietario' ? (
                  <Sprout className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                )}
                <p className="text-sm">
                  Te registrás como{' '}
                  <span className="font-semibold">
                    {tipo === 'propietario' ? 'propietario de campo' : 'inversor'}
                  </span>
                </p>
              </div>

              <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">
                    {tipo === 'propietario' ? 'Tu nombre' : 'Tu nombre completo'}
                  </Label>
                  <Input id="nombre" autoComplete="name" placeholder="Juan Pérez" {...register('nombre')} />
                  {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
                </div>

                {tipo === 'propietario' && (
                  <div className="space-y-2">
                    <Label htmlFor="nombreCuenta">Nombre del campo o empresa</Label>
                    <Input
                      id="nombreCuenta"
                      placeholder="Campo La Escondida"
                      {...register('nombreCuenta')}
                    />
                    {errors.nombreCuenta && (
                      <p className="text-sm text-destructive">{errors.nombreCuenta.message}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" {...register('email')} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    {...register('password')}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear cuenta
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground mt-5 pt-5 border-t border-border">
                ¿Ya tenés cuenta?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Ingresá
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
