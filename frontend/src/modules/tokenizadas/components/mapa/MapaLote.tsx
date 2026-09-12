import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import * as turf from '@turf/turf';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import { hectareas } from '../../utils/format';

export type Modo = 'ver' | 'dibujar' | 'editar';

interface Props {
  modo?: Modo;
  /** Polígono actual (GeoJSON) — se muestra sobre el mapa. */
  poligono?: GeoJSON.Polygon | null;
  /** Callback cuando el usuario dibuja o edita el polígono. */
  onCambio?: (poligono: GeoJSON.Polygon | null, superficieHa: number) => void;
  /** Centro inicial. Default: zona núcleo (Pergamino). */
  centro?: [number, number];
  /** Zoom inicial. */
  zoom?: number;
  height?: string | number;
}

/**
 * Mapa con capa satelital Esri World Imagery + herramientas de dibujo.
 * Modos:
 *  - `ver`: solo lectura, muestra el polígono si viene por props.
 *  - `dibujar`: barra de dibujo activa, sin polígono inicial.
 *  - `editar`: barra de edición, con el polígono ya dibujado editable.
 *
 * Cuando el usuario dibuja o edita, dispara `onCambio(poligono, superficieHa)`.
 * La superficie se calcula con @turf/area en m² y se convierte a hectáreas.
 */
export function MapaLote({
  modo = 'ver',
  poligono,
  onCambio,
  centro = [-33.89, -60.6],
  zoom = 12,
  height = 400,
}: Props) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40" style={{ height }}>
      <MapContainer center={centro} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='Tiles © Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <TileLayer
          url="https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          opacity={0.6}
        />
        <DrawControl modo={modo} poligono={poligono ?? null} onCambio={onCambio} />
      </MapContainer>
    </div>
  );
}

interface DrawProps {
  modo: Modo;
  poligono: GeoJSON.Polygon | null;
  onCambio?: (poligono: GeoJSON.Polygon | null, superficieHa: number) => void;
}

function DrawControl({ modo, poligono, onCambio }: DrawProps) {
  const map = useMap();
  const layerRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<any>(null);

  useEffect(() => {
    // Fix icons para Leaflet (Vite + npm no incluye assets por default)
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  useEffect(() => {
    if (!map) return;

    const featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);
    layerRef.current = featureGroup;

    // Dibujar el polígono existente
    if (poligono) {
      const layer = L.geoJSON(poligono, {
        style: {
          color: '#16C784',
          weight: 2,
          fillOpacity: 0.15,
          fillColor: '#16C784',
          dashArray: '4,4',
        },
      });
      layer.eachLayer((l) => featureGroup.addLayer(l));
      // Zoom al polígono
      try {
        const bounds = featureGroup.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
      } catch {
        /* noop */
      }
    }

    if (modo === 'ver') {
      return () => {
        map.removeLayer(featureGroup);
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawControl = new (L.Control as any).Draw({
      position: 'topright',
      draw: {
        polygon:
          modo === 'dibujar'
            ? {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                  color: '#16C784',
                  fillColor: '#16C784',
                  fillOpacity: 0.15,
                  weight: 2,
                },
              }
            : false,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup,
        edit: modo === 'editar' ? {} : false,
        remove: {},
      },
    });
    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    const handleCreated = (e: any) => {
      // Reemplazá cualquier polígono existente por el nuevo
      featureGroup.clearLayers();
      featureGroup.addLayer(e.layer);
      emitirCambio();
    };
    const handleEdited = () => emitirCambio();
    const handleDeleted = () => emitirCambio();

    function emitirCambio() {
      const layers = featureGroup.getLayers();
      if (layers.length === 0) {
        onCambio?.(null, 0);
        return;
      }
      const gj = (layers[0] as any).toGeoJSON();
      const poly = (gj.type === 'Feature' ? gj.geometry : gj) as GeoJSON.Polygon;
      const areaM2 = turf.area(poly);
      onCambio?.(poly, areaM2 / 10000);
    }

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
      if (drawControlRef.current) map.removeControl(drawControlRef.current);
      map.removeLayer(featureGroup);
    };
  }, [map, modo, poligono, onCambio]);

  return null;
}

/** Utilitario: parsea KML y devuelve el primer Polygon encontrado. */
export function parsearKml(kmlText: string): GeoJSON.Polygon | null {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, 'text/xml');
    const geo = kmlToGeoJson(xml);
    for (const feature of geo.features) {
      if (feature.geometry?.type === 'Polygon') return feature.geometry as GeoJSON.Polygon;
      if (feature.geometry?.type === 'MultiPolygon') {
        const first = (feature.geometry as GeoJSON.MultiPolygon).coordinates[0];
        return { type: 'Polygon', coordinates: first };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Calcula la superficie de un polígono en hectáreas. */
export function superficiePoligonoHa(p: GeoJSON.Polygon): number {
  return turf.area(p) / 10000;
}

/** Muestra la superficie de un polígono formateada. */
export function AreaBadge({ poligono }: { poligono: GeoJSON.Polygon | null }) {
  const area = useMemo(() => (poligono ? superficiePoligonoHa(poligono) : 0), [poligono]);
  if (!poligono) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5 text-xs font-medium ring-1 ring-emerald-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      {hectareas(area)}
    </span>
  );
}
