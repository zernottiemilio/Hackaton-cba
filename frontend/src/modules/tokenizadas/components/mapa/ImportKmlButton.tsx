import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { parsearKml } from './MapaLote';

interface Props {
  onCargar: (poligono: GeoJSON.Polygon) => void;
}

/**
 * Botón que abre un file picker, lee un archivo .kml o .kmz (solo primero
 * del zip) y devuelve el primer Polygon como GeoJSON.
 *
 * KMZ es un zip con doc.kml adentro. Por simplicidad soportamos solo KML puro
 * en la demo; para KMZ real hace falta jszip + descomprimir.
 */
export function ImportKmlButton({ onCargar }: Props) {
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const abrirPicker = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      const text = await file.text();
      const poligono = parsearKml(text);
      if (!poligono) {
        toast.error('No se encontró un polígono en el archivo KML');
        return;
      }
      onCargar(poligono);
      toast.success('Polígono importado');
    } catch {
      toast.error('No pudimos leer el archivo');
    } finally {
      setCargando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        onClick={abrirPicker}
        disabled={cargando}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm font-medium transition-colors disabled:opacity-50"
      >
        <span>📥</span>
        {cargando ? 'Leyendo...' : 'Importar KML'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".kml,application/vnd.google-earth.kml+xml"
        onChange={handleFile}
        className="hidden"
      />
    </>
  );
}
