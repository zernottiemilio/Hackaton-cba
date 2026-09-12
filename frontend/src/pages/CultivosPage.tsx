import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Wheat, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/Sheet';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/EmptyState';
import { cultivosService } from '@/services/cultivosService';
import { extraerMensajeError } from '@/lib/apiClient';
import type { Cultivo } from '@/types/agro';

const colorCultivo = (nombre: string) => {
  const map: Record<string, string> = {
    soja: '#A8B948', trigo: '#E8B53D', maíz: '#F2A03C',
    maiz: '#F2A03C', girasol: '#F4D03F', sorgo: '#B8482A',
  };
  return map[nombre.toLowerCase()] ?? '#047C00';
};

export function CultivosPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Cultivo | null>(null);
  const [nombre, setNombre] = useState('');

  const { data } = useQuery({
    queryKey: ['cultivos'],
    queryFn: () => cultivosService.listar({ limit: 100 }),
  });

  const crear = useMutation({
    mutationFn: (n: string) => cultivosService.crear(n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultivos'] });
      toast.success('Cultivo agregado');
      setNombre('');
      setCreating(false);
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  const actualizar = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => cultivosService.actualizar(id, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultivos'] });
      toast.success('Cultivo actualizado');
      setEditing(null);
      setNombre('');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => cultivosService.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cultivos'] });
      toast.success('Cultivo eliminado');
    },
    onError: (e) => toast.error(extraerMensajeError(e)),
  });

  const abrirEditar = (c: Cultivo) => {
    setEditing(c);
    setNombre(c.nombre);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Catálogo compartido por toda la cuenta</p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Cultivos</h1>
        </div>
        <Button onClick={() => { setNombre(''); setCreating(true); }}>
          <Plus className="h-4 w-4" /> Nuevo cultivo
        </Button>
      </header>

      {!data || data.items.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="Sin cultivos cargados"
          action={{ label: 'Agregar primer cultivo', onClick: () => setCreating(true) }}
        />
      ) : (
        <ul className="flex flex-wrap gap-3">
          <AnimatePresence>
            {data.items.map((c, i) => {
              const color = colorCultivo(c.nombre);
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ delay: i * 0.025 }}
                  className="group relative h-12 px-4 rounded-full flex items-center gap-2 border"
                  style={{ borderColor: `${color}55`, background: `${color}12` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-medium capitalize text-foreground">{c.nombre}</span>
                  <div className="ml-2 lg:opacity-0 lg:group-hover:opacity-100 flex items-center gap-1 transition">
                    <button
                      onClick={() => abrirEditar(c)}
                      className="h-6 w-6 rounded-full bg-foreground/10 text-foreground flex items-center justify-center"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar cultivo "${c.nombre}"?`)) eliminar.mutate(c.id);
                      }}
                      className="h-6 w-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Sheet crear/editar */}
      <Sheet
        open={creating || !!editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); setNombre(''); } }}
        title={editing ? 'Editar cultivo' : 'Nuevo cultivo'}
        description={editing ? 'Cambiá el nombre del cultivo.' : 'Agregá un cultivo al catálogo.'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = nombre.trim();
            if (!trimmed) return;
            if (editing) actualizar.mutate({ id: editing.id, n: trimmed });
            else crear.mutate(trimmed);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="cn">Nombre</Label>
            <Input id="cn" placeholder="Ej: arveja" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => { setCreating(false); setEditing(null); setNombre(''); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending || actualizar.isPending}>
              {(crear.isPending || actualizar.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
