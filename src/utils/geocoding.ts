import { Coordinates } from '../types';
import { calculateDistanceKm } from './routing';

export interface SectorItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'sector' | 'plaza' | 'avenida';
  badge?: string;
}

export const SANTO_DOMINGO_SECTORS: SectorItem[] = [
  // Loma de Cabrera (Sede Principal BLACK VAPE - Colmado Noadia)
  { id: 'colmado_noadia', name: 'Colmado Noadia (RD-45, Juan Pablo Duarte)', lat: 19.41688, lng: -71.61287, category: 'sector', badge: 'Tienda' },
  { id: 'parque_central_loma', name: 'Parque Central Loma de Cabrera', lat: 19.4245, lng: -71.6152, category: 'sector', badge: 'Centro' },
  { id: 'el_corozo_loma', name: 'Sector El Corozo', lat: 19.4125, lng: -71.6180, category: 'sector', badge: 'Popular' },
  { id: 'barrio_norte_loma', name: 'Barrio Norte / Quisqueya (Loma)', lat: 19.4280, lng: -71.6140, category: 'sector' },
  { id: 'balneario_el_salto', name: 'Balneario El Salto', lat: 19.4080, lng: -71.6090, category: 'plaza', badge: 'Turístico' },
  { id: 'hospital_loma', name: 'Hospital Ramón Adriano Villalona', lat: 19.4210, lng: -71.6170, category: 'plaza' },
  { id: 'salida_dajabon', name: 'Carretera a Dajabón (RD-45 Norte)', lat: 19.4350, lng: -71.6160, category: 'avenida' },
  { id: 'salida_restauracion', name: 'Carretera a Restauración (RD-45 Sur)', lat: 19.4050, lng: -71.6110, category: 'avenida' },

  // Distrito Nacional Sectores Principales
  { id: 'piantini', name: 'Piantini', lat: 18.4735, lng: -69.9405, category: 'sector', badge: 'Popular' },
  { id: 'naco', name: 'Naco', lat: 18.4770, lng: -69.9320, category: 'sector', badge: 'Popular' },
  { id: 'bella_vista', name: 'Bella Vista', lat: 18.4550, lng: -69.9480, category: 'sector', badge: 'Popular' },
  { id: 'evaristo', name: 'Evaristo Morales', lat: 18.4680, lng: -69.9460, category: 'sector', badge: 'Céntrico' },
  { id: 'gazcue', name: 'Gazcue', lat: 18.4710, lng: -69.8990, category: 'sector' },
  { id: 'mirador_sur', name: 'Mirador Sur', lat: 18.4480, lng: -69.9600, category: 'sector' },
  { id: 'mirador_norte', name: 'Mirador Norte', lat: 18.4580, lng: -69.9570, category: 'sector' },
  { id: 'paraiso', name: 'Paraíso', lat: 18.4810, lng: -69.9420, category: 'sector' },
  { id: 'serralles', name: 'Serrallés', lat: 18.4840, lng: -69.9330, category: 'sector' },
  { id: 'los_prados', name: 'Los Prados', lat: 18.4780, lng: -69.9530, category: 'sector' },
  { id: 'arroyo_hondo', name: 'Arroyo Hondo', lat: 18.4980, lng: -69.9470, category: 'sector' },
  { id: 'zona_colonial', name: 'Zona Colonial', lat: 18.4730, lng: -69.8850, category: 'sector', badge: 'Turístico' },
  { id: 'ciudad_nueva', name: 'Ciudad Nueva', lat: 18.4660, lng: -69.8930, category: 'sector' },
  { id: 'quisqueya', name: 'Ensanche Quisqueya', lat: 18.4660, lng: -69.9390, category: 'sector' },
  { id: 'la_julia', name: 'La Julia', lat: 18.4630, lng: -69.9300, category: 'sector' },
  { id: 'zona_universitaria', name: 'Zona Universitaria / UASD', lat: 18.4580, lng: -69.9180, category: 'sector' },
  { id: 'el_millon', name: 'El Millón', lat: 18.4670, lng: -69.9540, category: 'sector' },
  { id: 'urb_real', name: 'Urbanización Real', lat: 18.4480, lng: -69.9720, category: 'sector' },
  { id: 'renacimiento', name: 'Renacimiento', lat: 18.4450, lng: -69.9650, category: 'sector' },
  { id: 'esperilla', name: 'La Esperilla', lat: 18.4715, lng: -69.9120, category: 'sector' },

  // Plazas y Puntos Clave
  { id: 'bluemall', name: 'BlueMall (Av. Churchill)', lat: 18.4732, lng: -69.9402, category: 'plaza', badge: 'Plaza' },
  { id: 'agora', name: 'Ágora Mall (Av. Lincoln)', lat: 18.4831, lng: -69.9385, category: 'plaza', badge: 'Plaza' },
  { id: 'downtown', name: 'Downtown Center (Av. Núñez de Cáceres)', lat: 18.4533, lng: -69.9442, category: 'plaza', badge: 'Plaza' },
  { id: 'acropolis', name: 'Acrópolis Business Mall', lat: 18.4725, lng: -69.9408, category: 'plaza', badge: 'Plaza' },
  { id: 'sambil', name: 'Sambil Santo Domingo', lat: 18.4815, lng: -69.9125, category: 'plaza', badge: 'Plaza' },
];

/**
 * Finds the nearest sector in Santo Domingo for a given coordinate
 */
export function findNearestSector(
  coords: Coordinates,
  categoryFilter?: 'sector' | 'plaza'
): { sector: SectorItem; distanceKm: number } {
  const pool = categoryFilter
    ? SANTO_DOMINGO_SECTORS.filter((s) => s.category === categoryFilter)
    : SANTO_DOMINGO_SECTORS;

  let nearest = pool[0];
  let minDistance = calculateDistanceKm(coords, { lat: nearest.lat, lng: nearest.lng });

  for (let i = 1; i < pool.length; i++) {
    const s = pool[i];
    const dist = calculateDistanceKm(coords, { lat: s.lat, lng: s.lng });
    if (dist < minDistance) {
      minDistance = dist;
      nearest = s;
    }
  }

  return { sector: nearest, distanceKm: minDistance };
}

// In-memory cache for reverse geocode calls
const reverseGeocodeCache = new Map<string, string>();

/**
 * Reverse geocodes coordinates to a readable street or sector address.
 * Uses Nominatim with fallback to closest known Santo Domingo sector.
 */
export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const cacheKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached) return cached;

  const nearest = findNearestSector(coords);
  const fallbackString =
    nearest.distanceKm < 1.8
      ? `${nearest.sector.name}, Santo Domingo`
      : `Sector a ${nearest.distanceKm} km de ${nearest.sector.name}, Santo Domingo`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'es',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood;
        const houseNumber = addr.house_number ? ` #${addr.house_number}` : '';
        const suburb = addr.neighbourhood || addr.suburb || addr.quarter || nearest.sector.name;
        const city = addr.city || addr.town || 'Santo Domingo';

        let resolved = '';
        if (road) {
          resolved = `${road}${houseNumber}, ${suburb}, ${city}`;
        } else if (suburb) {
          resolved = `${suburb}, ${city}`;
        } else {
          resolved = fallbackString;
        }

        reverseGeocodeCache.set(cacheKey, resolved);
        return resolved;
      }
    }
  } catch {
    // Timeout or network error -> use fallback
  }

  reverseGeocodeCache.set(cacheKey, fallbackString);
  return fallbackString;
}

export interface GPSLocationResult {
  coords: Coordinates;
  accuracyMeters: number;
  isHighAccuracy: boolean;
}

/**
 * Gets high-accuracy GPS coordinates using browser API
 */
export function getHighAccuracyGPS(): Promise<GPSLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Tu navegador o dispositivo no soporta geolocalización GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          accuracyMeters: Math.round(position.coords.accuracy || 15),
          isHighAccuracy: (position.coords.accuracy || 100) < 60,
        });
      },
      (error) => {
        let msg = 'No se pudo obtener tu ubicación GPS.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Permiso de ubicación denegado. Puedes pulsar tu sector o marcar en el mapa.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = 'Señal GPS no disponible temporalmente. Elige tu sector en la lista.';
            break;
          case error.TIMEOUT:
            msg = 'El GPS tardó demasiado en responder. Selecciona tu sector para entrega rápida.';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 0,
      }
    );
  });
}
