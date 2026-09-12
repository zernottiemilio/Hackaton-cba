import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoLockup } from '@/components/layout/Logo';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { extraerMensajeError } from '@/lib/apiClient';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
      navigate('/', { replace: true });
    },
    onError: (err) => toast.error(extraerMensajeError(err)),
  });

  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      {/* Fondo en degradé + manchas verdes desenfocadas */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div
        className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
        style={{ background: 'radial-gradient(circle, #047C00 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-3xl opacity-15"
        style={{ background: 'radial-gradient(circle, #06820B 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="relative w-full max-w-md"
      >
        <div className="glass rounded-2xl shadow-lift p-8">
          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <LogoLockup size={42} animated />
            <p className="text-sm text-muted-foreground">Crecimiento medible</p>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="demo@agrofacil.dev"
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ingresar
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-5 pt-5 border-t border-border">
            Demo: <code className="bg-muted/70 px-1.5 py-0.5 rounded font-mono text-foreground">demo@agrofacil.dev</code>{' '}
            ·{' '}
            <code className="bg-muted/70 px-1.5 py-0.5 rounded font-mono text-foreground">agrofacil123</code>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Plataforma de gestión para productores agropecuarios
        </p>
      </motion.div>
    </div>
  );
}
