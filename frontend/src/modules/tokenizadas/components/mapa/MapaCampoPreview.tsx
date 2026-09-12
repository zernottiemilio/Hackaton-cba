import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Mapa readonly del campo. Muestra el polígono real (GeoJSON) sobre tiles
 * satelitales de Esri. Sin controles interactivos: pensado para hero y
 * cards del marketplace, no para editar.
 *
 * Fallbacks:
 *  - Si viene `geometria` (Polygon): dibuja el polígono y ajusta el mapa
 *    al bounding box.
 *  - Si no hay geometría pero sí `latitud`/`longitud`: marker centrado.
 *  - Si no hay nada: no monta el mapa; el caller muestra su placeholder.
 *
 * Para usar en cards chicas donde el bundle de Leaflet pesa mucho, importar
 * con `React.lazy()` así solo se carga cuando aparece en pantalla.
 */

interface Props {
  geometria: unknown;
  latitud?: number | string | null;
  longitud?: number | string | null;
  /** Sin interacción (default true). En `false` habilita drag + zoom. */
  readonly?: boolean;
  /** Ocultar la etiqueta "Esri" en la esquina para las cards. Default true. */
  ocultarAttribution?: boolean;
  className?: string;
}

export function MapaCampoPreview({
  geometria,
  latitud,
  longitud,
  readonly = true,
  ocultarAttribution = true,
  className,
}: Props) {
  const poligono = useMemo(() => normalizarPoligono(geometria), [geometria]);
  const lat = numeroOrNull(latitud);
  const lon = numeroOrNull(longitud);
  const centro = useMemo<[number, number]>(() => {
    if (poligono) return centroide(poligono);
    if (lat !== null && lon !== null) return [lat, lon];
    return [-33.89, -60.6]; // Pergamino default
  }, [poligono, lat, lon]);

  const zoom = poligono ? 13 : lat !== null ? 12 : 11;

  return (
    <div
      className={className}
      // pointer-events: none en readonly deja que el click atraviese al Link
      // que envuelve la card. Con interacciones desactivadas, no hace falta
      // que el mapa reciba eventos.
      style={{ position: 'absolute', inset: 0, pointerEvents: readonly ? 'none' : 'auto' }}
    >
      <MapContainer
        center={centro}
        zoom={zoom}
        zoomControl={!readonly}
        dragging={!readonly}
        scrollWheelZoom={!readonly}
        doubleClickZoom={!readonly}
        touchZoom={!readonly}
        boxZoom={!readonly}
        keyboard={!readonly}
        attributionControl={!ocultarAttribution}
        style={{ height: '100%', width: '100%', background: '#0b1620' }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri"
          maxZoom={19}
        />
        <TileLayer
          url="https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          opacity={0.55}
        />
        <Overlay poligono={poligono} lat={lat} lon={lon} />
      </MapContainer>
    </div>
  );
}

function Overlay({
  poligono,
  lat,
  lon,
}: {
  poligono: GeoJSON.Polygon | null;
  lat: number | null;
  lon: number | null;
}) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (poligono) {
      const layer = L.geoJSON(poligono, {
        style: {
          color: '#2BE06A',
          weight: 2,
          opacity: 0.9,
          fillColor: '#2BE06A',
          fillOpacity: 0.18,
        },
      });
      layer.addTo(map);
      layerRef.current = layer;
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      }
    } else if (lat !== null && lon !== null) {
      const marker = L.circleMarker([lat, lon], {
        radius: 10,
        color: '#2BE06A',
        weight: 2,
        fillColor: '#2BE06A',
        fillOpacity: 0.4,
      });
      marker.addTo(map);
      layerRef.current = marker;
      map.setView([lat, lon], 12);
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [poligono, lat, lon, map]);

  return null;
}

function normalizarPoligono(g: unknown): GeoJSON.Polygon | null {
  if (!g || typeof g !== 'object') return null;
  const obj = g as { type?: string; coordinates?: unknown; geometry?: unknown };
  if (obj.type === 'Feature' && obj.geometry) return normalizarPoligono(obj.geometry);
  if (obj.type !== 'Polygon' || !Array.isArray(obj.coordinates)) return null;
  return obj as GeoJSON.Polygon;
}

function centroide(poly: GeoJSON.Polygon): [number, number] {
  const anillo = poly.coordinates?.[0] ?? [];
  if (anillo.length === 0) return [-33.89, -60.6];
  let lat = 0;
  let lon = 0;
  for (const [x, y] of anillo) {
    lon += x;
    lat += y;
  }
  return [lat / anillo.length, lon / anillo.length];
}

function numeroOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

// Default export para `React.lazy(() => import('...'))`.
export default MapaCampoPreview;
