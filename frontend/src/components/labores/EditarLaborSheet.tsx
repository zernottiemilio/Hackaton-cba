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
import { laboresService } from '@/services/laboresService';
import { extraerMensajeError } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import type { Labor, TipoLabor } from '@/types/agro';

const TIPOS: { value: TipoLabor; label: string }[] = [
  { value: 'siembra',        label: 'Siembra' },
  { value: 'pulverizacion',  label: 'Pulverización' },
  { value: 'fertilizacion',  label: 'Fertilización' },
  { value: 'cosecha',        label: 'Cosecha' },
  { value: 'otra',           label: 'Otra' },
];

const schema = z.object({
  tipo: z.enum(['siembra', 'pulverizacion', 'fertilizacion', 'cosecha', 'otra']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ejecutor: z.enum(['propio', 'contratista']),
  costoTotalUsd: z.coerce.number().nonnegative().optional(),
  formaPago: z.enum(['contado', 'canje', 'financiado']).optional(),
  nota: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  open: boolean;
  labor: Labor | null;
  onClose: () => void;
  invalidateKeys?: string[][];
}

export function EditarLaborSheet({ open, labor, onClose, invalidateKeys = [] }: Props) {
  const qc = useQueryClient();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    values: labor
      ? {
          tipo: labor.tipo,
          fecha: labor.fecha.slice(0, 10),
          ejecutor: labor.ejecutor,
          costoTotalUsd: labor.costoTotalUsd !== null ? Number(labor.costoTotalUsd) : undefined,
          formaPago: labor.formaPago ?? undefined,
          nota: labor.nota ?? '',
        }
      : {
          tipo: 'pulverizacion',
          fecha: new Date().toISOString().slice(0, 10),
          ejecutor: 'contratista',
          costoTotalUsd: undefined,
          formaPago: undefined,
          nota: '',
        },
  });

  const tipo = watch('tipo');
  const ejecutor = watch('ejecutor');
  const formaPago = watch('formaPago');

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      laboresService.actualizar(labor!.id, {
        tipo: data.tipo as TipoLabor,
        fecha: data.fecha,
        ejecutor: data.ejecutor,
        ...(data.costoTotalUsd !== undefined ? { costoTotalUsd: data.costoTotalUsd } : {}),
        ...(data.formaPago ? { formaPago: data.formaPago } : {}),
        ...(data.nota ? { nota: data.nota } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labores'] });
      qc.invalidateQueries({ queryKey: ['lote-campania'] });
      qc.invalidateQueries({ queryKey: ['resultado'] });
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success('Labor actualizada');
      onClose();
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  if (!labor) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Editar labor"
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de labor</Label>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lf">Fecha</Label>
            <Input id="lf" type="date" {...register('fecha')} />
            {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Ejecutor</Label>
            <div className="grid grid-cols-2 gap-1">
              {(['propio', 'contratista'] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setValue('ejecutor', e)}
                  className={cn(
                    'h-10 rounded-md border text-sm font-medium capitalize transition',
                    ejecutor === e ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-surface hover:border-primary/40',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lc">Costo total (USD)</Label>
            <Input id="lc" type="number" step="0.01" min="0" placeholder="—"
              {...register('costoTotalUsd', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
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

        <div className="space-y-2">
          <Label htmlFor="ln">Nota</Label>
          <Input id="ln" placeholder="Opcional" {...register('nota')} />
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
