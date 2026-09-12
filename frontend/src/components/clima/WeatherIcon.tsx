import {
  Sun, Moon, Cloud, CloudSun, CloudFog, CloudDrizzle,
  CloudRain, CloudRainWind, CloudSnow, CloudLightning,
  type LucideIcon,
} from 'lucide-react';

interface Props {
  icono: string;
  esDeNoche?: boolean;
  className?: string;
  size?: number;
}

/** Mapea el slug de ícono (devuelto por backend) al componente lucide-react. */
const MAP: Record<string, LucideIcon> = {
  'sun': Sun,
  'cloud-sun': CloudSun,
  'cloud': Cloud,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  'cloud-rain-wind': CloudRainWind,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
};

export function WeatherIcon({ icono, esDeNoche, className, size = 24 }: Props) {
  // De noche con cielo despejado mostramos luna en vez de sol
  if (esDeNoche && icono === 'sun') {
    return <Moon className={className} style={{ width: size, height: size }} />;
  }
  const Icon = MAP[icono] ?? Cloud;
  return <Icon className={className} style={{ width: size, height: size }} />;
}
