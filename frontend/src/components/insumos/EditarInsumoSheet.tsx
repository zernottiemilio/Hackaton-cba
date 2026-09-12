import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/Sheet';
import { insumosAplicadosService } from '@/services/insumosAplicadosService';
import { extraerMensajeError } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import type { FormaPago, InsumoAplicado, TipoInsumo } from '@/types/agro';

const TIPOS: { value: TipoInsumo; label: string }[] = [
  { value: 'semilla',      label: 'Semilla' },
  { value: 'fertilizante', label: 'Fertilizante' },
  { value: 'herbicida',    label: 'Herbicida' },
  { value: 'insecticida',  label: 'Insecticida' },
  { value: 'fungicida',    label: 'Fungicida' },
  { value: 'otro',         label: 'Otro' },
];

const UNIDADES = ['lt', 'kg', 'bolsa', 'sem/ha', 'gr/ha'];

const schema = z.object({
  tipo: z.enum(['semilla', 'fertilizante', 'herbicida', 'insecticida', 'fungicida', 'otro']),
  producto: z.string().min(1, 'Requerido'),
  cantidad: z.coerce.number().positive(),
  unidad: z.string().min(1, 'Requerido'),
  costoTotalUsd: z.coerce.number().nonnegative(),
  formaPago: z.enum(['contado', 'canje', 'financiado']).optional(),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  open: boolean;
  insumo: InsumoAplicado | null;
  onClose: () => void;
  /** Lista de queryKeys a invalidar al actualizar */
  invalidateKeys?: string[][];
}

export function EditarInsumoSheet({ open, insumo, onClose, invalidateKeys = [] }: Props) {
  const qc = useQueryClient();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    values: insumo
      ? {
          tipo: insumo.tipo,
          producto: insumo.producto,
          cantidad: Number(insumo.cantidad),
          unidad: insumo.unidad,
          costoTotalUsd: Number(insumo.costoTotalUsd),
          formaPago: insumo.formaPago ?? undefined,
        }
      : {
          tipo: 'herbicida',
          producto: '',
          cantidad: 0,
          unidad: 'lt',
          costoTotalUsd: 0,
          formaPago: undefined,
        },
  });

  const tipo = watch('tipo');
  const unidad = watch('unidad');
  const formaPago = watch('formaPago');

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      insumosAplicadosService.actualizar(insumo!.id, {
        tipo: data.tipo as TipoInsumo,
        producto: data.producto,
        cantidad: data.cantidad,
        unidad: data.unidad,
        costoTotalUsd: data.costoTotalUsd,
        formaPago: (data.formaPago as FormaPago | undefined) ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insumos-aplicados'] });
      qc.invalidateQueries({ queryKey: ['lote-campania'] });
      qc.invalidateQueries({ queryKey: ['resultado'] });
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success('Insumo actualizado');
      onClose();
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  if (!insumo) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Editar insumo"
      description={insumo.producto}
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setValue('tipo', t.value, { shouldValidate: true })}
                className={cn(
                  'h-9 px-3 rounded-full border text-sm font-medium transition',
                  tipo === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface hover:border-primary/40',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prod">Producto *</Label>
          <Input id="prod" placeholder="Ej: Glifosato 48%" {...register('producto')} />
          {errors.producto && <p className="text-xs text-destructive">{errors.producto.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cant">Cantidad *</Label>
            <Input id="cant" type="number" step="0.01" min="0"
              {...register('cantidad', { setValueAs: (v) => v === '' ? 0 : Number(v) })} />
            {errors.cantidad && <p className="text-xs text-destructive">{errors.cantidad.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Unidad</Label>
            <div className="grid grid-cols-3 gap-1">
              {UNIDADES.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setValue('unidad', u, { shouldValidate: true })}
                  className={cn(
                    'h-10 rounded-md border text-xs font-medium transition',
                    unidad === u ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ic">Costo total (USD) *</Label>
            <Input id="ic" type="number" step="0.01" min="0"
              {...register('costoTotalUsd', { setValueAs: (v) => v === '' ? 0 : Number(v) })} />
            {errors.costoTotalUsd && <p className="text-xs text-destructive">{errors.costoTotalUsd.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Forma de pago</Label>
            <div className="grid grid-cols-3 gap-1">
              {(['contado', 'canje', 'financiado'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setValue('formaPago', formaPago === p ? undefined : p)}
                  className={cn(
                    'h-10 rounded-md border text-xs font-medium capitalize transition',
                    formaPago === p ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
