import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { Coordinates, Order, StoreConfig } from '../types';
import {
  fetchStreetRoute,
  StreetRouteResult,
  calculateDistanceKm,
  calculateDeliveryFee,
  DELIVERY_ZONES,
  DeliveryZoneConfig,
} from '../utils/routing';
import {
  Navigation,
  Store,
  MapPin,
  Phone,
  Layers,
  Maximize2,
  Minimize2,
  Compass,
  Crosshair,
  Route,
  Check,
  ChevronDown,
  Sparkles,
  Radar,
  Info,
} from 'lucide-react';

export type MapMode = 'calles' | 'satelite' | 'politico' | 'oscuro' | 'terreno';

export interface MapModeConfig {
  id: MapMode;
  name: string;
  badge: string;
  icon: string;
  description: string;
  url: string;
  subdomains?: string[];
  maxZoom: number;
  attribution: string;
  overlayUrl?: string; // Transparent street names and boundaries overlay
}

export const MAP_MODES: Record<MapMode, MapModeConfig> = {
  calles: {
    id: 'calles',
    name: 'Calles & Vías',
    badge: 'Vial',
    icon: '🗺️',
    description: 'Calles detalladas, vías principales y edificaciones (OSM)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  },
  satelite: {
    id: 'satelite',
    name: 'Satélite Híbrido',
    badge: 'HD Satélite',
    icon: '🛰️',
    description: 'Imágenes satelitales reales con nombres de calles superpuestos (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
    overlayUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  politico: {
    id: 'politico',
    name: 'Político & Sectores',
    badge: 'Político',
    icon: '🏛️',
    description: 'Demarcaciones territoriales, límites de sectores y división política (Esri Topo)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ, TomTom',
  },
  oscuro: {
    id: 'oscuro',
    name: 'Modo Nocturno',
    badge: 'Dark',
    icon: '🌙',
    description: 'Estilo oscuro de alto contraste con avenidas y luces destacadas (Esri Dark)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ',
    overlayUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  },
  terreno: {
    id: 'terreno',
    name: 'Relieve & Terreno',
    badge: 'Relieve',
    icon: '🏔️',
    description: 'Curvas de nivel topográficas, relieve sombreado y elevaciones (OpenTopo)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 17,
    attribution: '&copy; OpenTopoMap, OpenStreetMap contributors',
  },
};

interface MapViewProps {
  store: StoreConfig;
  activeOrders?: Order[];
  selectedLocation?: Coordinates;
  onSelectLocation?: (coords: Coordinates) => void;
  driverLocation?: Coordinates;
  driverName?: string;
  isDriverSignalLost?: boolean;
  routeWaypoints?: Coordinates[];
  highlightOrderId?: string;
  onOrderSelect?: (orderId: string) => void;
  isDraggableTarget?: boolean;
  targetLabel?: string;
  heightClass?: string;
  showAllControls?: boolean;
  flyToSelectedOnChange?: boolean;
  accuracyRadiusMeters?: number;
  showDeliveryZones?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  store,
  activeOrders = [],
  selectedLocation,
  onSelectLocation,
  driverLocation,
  driverName = 'Delivery Express',
  isDriverSignalLost = false,
  routeWaypoints = [],
  highlightOrderId,
  onOrderSelect,
  isDraggableTarget = false,
  targetLabel = 'Tu Ubicación',
  heightClass = 'h-[360px] md:h-[460px]',
  showAllControls = true,
  flyToSelectedOnChange = false,
  accuracyRadiusMeters,
  showDeliveryZones = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);

  // Map Mode State (persisted in localStorage)
  const [currentMapMode, setCurrentMapMode] = useState<MapMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vape_map_mode_v2') as MapMode;
      if (saved && MAP_MODES[saved]) return saved;
    }
    return 'satelite'; // Default to Satellite Híbrido as requested
  });

  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isZonesLegendOpen, setIsZonesLegendOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [streetRouteInfo, setStreetRouteInfo] = useState<StreetRouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Calculated distance and zone if selectedLocation is present
  const selectedDistance = useMemo(() => {
    if (!selectedLocation) return null;
    return calculateDistanceKm(store.location, selectedLocation);
  }, [store.location, selectedLocation]);

  const selectedDeliveryCalc = useMemo(() => {
    if (selectedDistance === null) return null;
    return calculateDeliveryFee(selectedDistance);
  }, [selectedDistance]);

  // Apply Tile Layer according to currentMapMode
  const applyTileLayer = useCallback((mode: MapMode) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old layers
    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (overlayTileLayerRef.current) {
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    const cfg = MAP_MODES[mode];

    // Add new base layer
    const baseLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains || 'abc',
    }).addTo(map);
    baseTileLayerRef.current = baseLayer;

    // Add optional overlay (e.g. transparent street names over satellite imagery)
    if (cfg.overlayUrl) {
      const overlayLayer = L.tileLayer(cfg.overlayUrl, {
        maxZoom: cfg.maxZoom,
        subdomains: cfg.subdomains || 'abc',
        zIndex: 650,
        opacity: 0.9,
      }).addTo(map);
      overlayTileLayerRef.current = overlayLayer;
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [
      selectedLocation?.lat ?? store.location.lat,
      selectedLocation?.lng ?? store.location.lng,
    ];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const zonesLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    zonesLayerRef.current = zonesLayer;
    routeLayerRef.current = routeLayer;
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Apply chosen map style
    applyTileLayer(currentMapMode);

    // Handle map click if selecting location
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onSelectLocation) {
        onSelectLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      zonesLayerRef.current = null;
      routeLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Switch Map Mode
  const handleSelectMode = (mode: MapMode) => {
    setCurrentMapMode(mode);
    setIsModeMenuOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vape_map_mode_v2', mode);
    }
    applyTileLayer(mode);
  };

  // Fetch real street routing when routeWaypoints change
  useEffect(() => {
    let isCancelled = false;

    if (!routeWaypoints || routeWaypoints.length < 2) {
      setStreetRouteInfo(null);
      return;
    }

    setIsLoadingRoute(true);
    fetchStreetRoute(routeWaypoints)
      .then((res) => {
        if (!isCancelled) {
          setStreetRouteInfo(res);
          setIsLoadingRoute(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIsLoadingRoute(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [routeWaypoints]);

  // Update Markers, Zones, and Street-following Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const routeLayer = routeLayerRef.current;
    const zonesLayer = zonesLayerRef.current;
    if (!map || !markersLayer || !routeLayer) return;

    markersLayer.clearLayers();
    routeLayer.clearLayers();
    if (zonesLayer) {
      zonesLayer.clearLayers();
    }

    // 0. Radial Delivery Fee Circles (Every 1.5 km = $25 DOP)
    if (showDeliveryZones && zonesLayer) {
      DELIVERY_ZONES.forEach((zone) => {
        const isCurrentTargetZone = selectedDeliveryCalc?.tier === zone.tier;

        const circle = L.circle([store.location.lat, store.location.lng], {
          radius: zone.radiusMeters,
          color: zone.color,
          fillColor: zone.fillColor,
          fillOpacity: isCurrentTargetZone ? 0.18 : 0.04,
          weight: isCurrentTargetZone ? 3.5 : 1.5,
          dashArray: isCurrentTargetZone ? undefined : '5, 6',
          interactive: true,
        });

        circle.bindTooltip(
          `<div class="p-1.5 text-center font-urban">
            <strong style="color:${zone.color}; font-size:12px;" class="block font-black">${zone.label}</strong>
            <span class="text-[10px] text-neutral-300">Costo Delivery: $${zone.fee} DOP • Hasta ${zone.maxKm} km</span>
            ${isCurrentTargetZone ? '<div class="text-[9px] text-emerald-400 font-bold mt-0.5">● Tu ubicación está en esta zona</div>' : ''}
          </div>`,
          {
            permanent: false,
            direction: 'top',
            className: 'leaflet-zone-tooltip bg-neutral-950/95 text-white border border-neutral-700 rounded-xl p-1 shadow-2xl',
          }
        );

        zonesLayer.addLayer(circle);

        // Cardinal perimeter tag at Bearing ~45 deg North-East along the circumference
        const offsetDegLat = (zone.radiusMeters / 111320) * 0.7071;
        const offsetDegLng =
          (zone.radiusMeters / (111320 * Math.cos((store.location.lat * Math.PI) / 180))) *
          0.7071;
        const tagCoord: [number, number] = [
          store.location.lat + offsetDegLat,
          store.location.lng + offsetDegLng,
        ];

        const tagIcon = L.divIcon({
          className: 'custom-zone-tag',
          html: `
            <div class="px-2 py-0.5 rounded-lg text-[9px] font-black font-urban shadow-xl border whitespace-nowrap pointer-events-none transition-all ${
              isCurrentTargetZone
                ? 'scale-110 bg-neutral-950 text-white ring-2 ring-emerald-400 font-black'
                : 'bg-neutral-950/90'
            }" style="color:${zone.color}; border-color:${zone.color}99;">
              ${zone.label}
            </div>
          `,
          iconSize: [64, 20],
          iconAnchor: [32, 10],
        });

        zonesLayer.addLayer(L.marker(tagCoord, { icon: tagIcon, interactive: false }));
      });
    }

    // 1. Store Marker (Physical Store)
    const storeIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div class="relative group cursor-pointer">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-xl shadow-violet-500/50 border-2 border-white flex items-center justify-center text-white font-bold text-lg">
            🏬
          </div>
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-neutral-950/95 text-[10px] text-white px-2 py-0.5 rounded shadow whitespace-nowrap border border-neutral-700 font-bold">
            ${store.name}
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });

    const storeMarker = L.marker([store.location.lat, store.location.lng], {
      icon: storeIcon,
    });
    storeMarker.bindPopup(`
      <div class="p-2 text-neutral-900 min-w-[200px]">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xl">🏬</span>
          <strong class="font-bold text-sm text-neutral-900">${store.name}</strong>
        </div>
        <p class="text-xs text-neutral-600 mb-2">${store.addressText}</p>
        <div class="flex items-center justify-between text-xs pt-1 border-t border-neutral-200">
          <span class="inline-flex items-center text-emerald-600 font-semibold">● Abierto • Tienda Central</span>
          <a href="tel:${store.phone}" class="text-violet-600 font-bold hover:underline flex items-center gap-1">
            📞 ${store.phone}
          </a>
        </div>
      </div>
    `);
    markersLayer.addLayer(storeMarker);

    // 2. Active Orders Markers
    activeOrders.forEach((order, idx) => {
      const isSelected = order.id === highlightOrderId;
      const statusBadgeColors: Record<string, string> = {
        pendiente_cotizacion: 'bg-amber-500',
        tarifa_propuesta: 'bg-blue-500',
        aprobado_en_preparacion: 'bg-indigo-500',
        en_camino: 'bg-emerald-500 animate-pulse',
        llegada_a_destino: 'bg-purple-600 animate-bounce',
        entregado: 'bg-neutral-500',
      };

      const orderIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative cursor-pointer transition-transform hover:scale-110 ${
            isSelected ? 'scale-125 z-30' : ''
          }">
            <div class="w-9 h-9 rounded-full ${
              isSelected ? 'bg-emerald-400 ring-4 ring-emerald-300' : 'bg-neutral-900'
            } text-white border-2 border-white shadow-xl flex items-center justify-center font-bold text-xs">
              #${idx + 1}
            </div>
            <div class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${
              statusBadgeColors[order.status] || 'bg-neutral-500'
            } border-2 border-white"></div>
            <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-neutral-950/95 text-[9px] text-white font-medium px-1.5 py-0.5 rounded shadow whitespace-nowrap border border-neutral-700">
              ${order.customerName.split(' ')[0]}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const orderMarker = L.marker([order.location.lat, order.location.lng], {
        icon: orderIcon,
      });

      const itemsListHtml = order.items
        .map(
          (it) =>
            `<li class="flex justify-between text-xs py-0.5">
              <span>${it.quantity}x ${it.productName} (${
                it.portion === 'tanque_lleno' ? 'Tanque Lleno' : 'Mitad'
              })</span>
              <span class="font-semibold text-neutral-800">$${it.unitPrice * it.quantity}</span>
            </li>`
        )
        .join('');

      orderMarker.bindPopup(`
        <div class="p-2 text-neutral-900 min-w-[220px]">
          <div class="flex items-center justify-between border-b pb-1 mb-2">
            <div>
              <span class="text-xs font-bold text-violet-700">Pedido #${order.id}</span>
              <h4 class="font-bold text-sm text-neutral-900">${order.customerName}</h4>
            </div>
            <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              statusBadgeColors[order.status]
            } text-white">
              ${order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <ul class="mb-2 divide-y divide-neutral-100">
            ${itemsListHtml}
          </ul>
          <div class="flex justify-between items-center text-xs font-bold pt-1 border-t border-neutral-200">
            <span>Total Recarga + Envío:</span>
            <span class="text-emerald-700 text-sm">$${order.totalAmount} DOP</span>
          </div>
          ${
            order.deliveryAddressNote
              ? `<p class="text-[11px] text-neutral-600 mt-1 italic">📍 ${order.deliveryAddressNote}</p>`
              : ''
          }
          <div class="mt-2 pt-2 border-t border-neutral-200 flex gap-2">
            <a href="tel:${order.customerPhone}" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-center py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow">
              📞 Llamar (${order.customerPhone})
            </a>
          </div>
        </div>
      `);

      orderMarker.on('click', () => {
        if (onOrderSelect) {
          onOrderSelect(order.id);
        }
      });

      markersLayer.addLayer(orderMarker);
    });

    // 3. User Selected / Current Destination Pin
    if (selectedLocation) {
      if (accuracyRadiusMeters && accuracyRadiusMeters > 0) {
        const accCircle = L.circle([selectedLocation.lat, selectedLocation.lng], {
          radius: Math.min(accuracyRadiusMeters, 300),
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          weight: 1.5,
          dashArray: '4, 4',
        });
        markersLayer.addLayer(accCircle);
      }

      const targetIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative cursor-move group">
            <div class="absolute -inset-2 bg-emerald-500/25 rounded-full animate-ping pointer-events-none"></div>
            <div class="w-10 h-10 rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/50 border-3 border-white flex items-center justify-center text-white text-lg">
              📍
            </div>
            <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-neutral-950/95 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md shadow whitespace-nowrap border border-emerald-500/40">
              ${targetLabel}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const targetMarker = L.marker([selectedLocation.lat, selectedLocation.lng], {
        icon: targetIcon,
        draggable: isDraggableTarget,
      });

      if (isDraggableTarget && onSelectLocation) {
        targetMarker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          onSelectLocation({ lat: latlng.lat, lng: latlng.lng });
        });
      }

      markersLayer.addLayer(targetMarker);
    }

    // 4. Delivery Driver Marker (Scooter with pulse radar ring or Signal Lost notice)
    if (driverLocation) {
      const ringHtml = isDriverSignalLost
        ? `<span class="relative inline-flex rounded-full h-11 w-11 bg-neutral-900 border-2 border-amber-500 shadow-xl text-white items-center justify-center text-xl">🛵</span>`
        : `<span class="flex h-11 w-11 relative">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-11 w-11 bg-neutral-900 border-2 border-cyan-400 shadow-xl text-white items-center justify-center text-xl">🛵</span>
          </span>`;

      const badgeHtml = isDriverSignalLost
        ? `<div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-amber-950/95 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded border border-amber-500 shadow whitespace-nowrap animate-pulse">
            ⚠️ Repartidor sin señal
          </div>`
        : `<div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-neutral-950 text-cyan-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-cyan-700/60 shadow whitespace-nowrap">
            ${driverName}
          </div>`;

      const driverIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative">
            ${ringHtml}
            ${badgeHtml}
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const driverMarker = L.marker([driverLocation.lat, driverLocation.lng], {
        icon: driverIcon,
      });
      driverMarker.bindPopup(`
        <div class="p-2 text-neutral-900 text-xs">
          <strong class="font-bold text-sm block">🛵 ${driverName}</strong>
          <span class="text-neutral-500">Repartidor activo en ruta por la calle</span>
        </div>
      `);
      markersLayer.addLayer(driverMarker);
    }

    // 5. Real Street Following Route (traces streets, curves, and turns)
    const pointsToDraw =
      streetRouteInfo && streetRouteInfo.coordinates.length > 1
        ? streetRouteInfo.coordinates
        : routeWaypoints;

    if (pointsToDraw && pointsToDraw.length > 1) {
      const latLngs = pointsToDraw.map((w) => [w.lat, w.lng] as [number, number]);

      // Outer glow line following streets
      const outerPolyline = L.polyline(latLngs, {
        color: currentMapMode === 'satelite' || currentMapMode === 'oscuro' ? '#10b981' : '#0284c7',
        weight: 7,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round',
      });
      routeLayer.addLayer(outerPolyline);

      // Core street vector polyline
      const corePolyline = L.polyline(latLngs, {
        color: currentMapMode === 'satelite' || currentMapMode === 'oscuro' ? '#34d399' : '#0284c7',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });
      routeLayer.addLayer(corePolyline);

      // Inner animated dashed line to convey direction of travel
      const dashPolyline = L.polyline(latLngs, {
        color: '#ffffff',
        weight: 2,
        opacity: 0.8,
        dashArray: '6, 10',
        lineCap: 'round',
        lineJoin: 'round',
      });
      routeLayer.addLayer(dashPolyline);
    }
  }, [
    store,
    activeOrders,
    selectedLocation,
    driverLocation,
    driverName,
    routeWaypoints,
    streetRouteInfo,
    currentMapMode,
    highlightOrderId,
    isDraggableTarget,
    onOrderSelect,
    onSelectLocation,
    showDeliveryZones,
    selectedDeliveryCalc,
  ]);

  // Center on Store
  const centerStore = () => {
    mapInstanceRef.current?.setView([store.location.lat, store.location.lng], 15, {
      animate: true,
    });
  };

  // Center on User/Target
  const centerSelected = () => {
    if (selectedLocation) {
      mapInstanceRef.current?.setView([selectedLocation.lat, selectedLocation.lng], 15, {
        animate: true,
      });
    }
  };

  // Fit all markers in view
  const fitAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const points: [number, number][] = [[store.location.lat, store.location.lng]];
    if (selectedLocation) points.push([selectedLocation.lat, selectedLocation.lng]);
    if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
    activeOrders.forEach((o) => points.push([o.location.lat, o.location.lng]));

    if (streetRouteInfo && streetRouteInfo.coordinates.length > 0) {
      streetRouteInfo.coordinates.forEach((c) => points.push([c.lat, c.lng]));
    }

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  // Fly to selected location when changed externally if requested
  useEffect(() => {
    if (flyToSelectedOnChange && selectedLocation && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([selectedLocation.lat, selectedLocation.lng], 16, {
        duration: 0.8,
      });
    }
  }, [flyToSelectedOnChange, selectedLocation?.lat, selectedLocation?.lng]);

  // Use High-Accuracy Browser Geolocation
  const handleGeolocate = () => {
    if (navigator.geolocation && onSelectLocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          onSelectLocation(coords);
          mapInstanceRef.current?.flyTo([coords.lat, coords.lng], 16, { duration: 0.8 });
        },
        () => {
          // Fallback or permission blocked
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  };

  // Invalidate map size when expanded
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  const activeModeConfig = MAP_MODES[currentMapMode];

  return (
    <div
      className={`relative w-full ${
        isExpanded ? 'h-[580px] md:h-[680px]' : heightClass
      } rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-950 transition-all duration-300`}
    >
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* TOP LEFT: Map Mode Switcher & Delivery Zones Legend */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 max-w-[calc(100%-120px)]">
        {/* Mode Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsModeMenuOpen(!isModeMenuOpen);
              setIsZonesLegendOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900/90 hover:bg-neutral-800 text-white rounded-2xl shadow-xl border border-neutral-700/80 backdrop-blur-md transition-all active:scale-95 cursor-pointer text-xs font-black"
            aria-label="Cambiar estilo de mapa"
          >
            <span className="text-base">{activeModeConfig.icon}</span>
            <span className="hidden sm:inline">{activeModeConfig.name}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold border border-emerald-500/30">
              {activeModeConfig.badge}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                isModeMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Mode Dropdown Menu */}
          {isModeMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl p-2 shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 space-y-1">
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 flex items-center justify-between">
                <span>Modos de Mapa Disponibles</span>
                <span className="text-cyan-400">En Vivo</span>
              </div>

              {(Object.keys(MAP_MODES) as MapMode[]).map((modeKey) => {
                const mode = MAP_MODES[modeKey];
                const isCurrent = currentMapMode === modeKey;

                return (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => handleSelectMode(modeKey)}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-neutral-800 border border-emerald-500/50 shadow'
                        : 'hover:bg-neutral-800/60 border border-transparent'
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{mode.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          {mode.name}
                          {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </span>
                        <span className="text-[9px] font-bold text-neutral-400 uppercase bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                          {mode.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                        {mode.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery Zones Legend Button */}
        {showDeliveryZones && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsZonesLegendOpen(!isZonesLegendOpen);
                setIsModeMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900/90 hover:bg-neutral-800 text-white rounded-2xl shadow-xl border border-cyan-500/50 backdrop-blur-md transition-all active:scale-95 cursor-pointer text-xs font-black"
              aria-label="Ver rangos y tarifas de delivery"
            >
              <Radar className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden sm:inline text-neutral-200">Tarifa:</span>
              <span className="text-cyan-300 font-bold">$25 c/1.5km</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                  isZonesLegendOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Zones Legend Dropdown */}
            {isZonesLegendOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl p-3 shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 space-y-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Radar className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-black text-white font-urban">Rangos de Tarifa a la Redonda</span>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                    Regla 1.5 km
                  </span>
                </div>

                <p className="text-[10px] text-neutral-300 leading-tight">
                  Cada <strong>1.5 km</strong> de distancia al local tiene un coste de <strong>$25 DOP</strong>. Los círculos en el mapa muestran el radio exacto de cada rango:
                </p>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {DELIVERY_ZONES.map((z) => {
                    const isSelectedZone = selectedDeliveryCalc?.tier === z.tier;
                    return (
                      <div
                        key={z.tier}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-colors ${
                          isSelectedZone
                            ? 'bg-neutral-800 border-emerald-400/80 shadow-md ring-1 ring-emerald-400/50'
                            : 'bg-neutral-950/70 border-neutral-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: z.color }}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-white block text-[11px] truncate">
                              {z.label}
                            </span>
                            <span className="text-[9px] text-neutral-400 block">
                              Radio: 0 a {z.maxKm} km del local
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-sm" style={{ color: z.color }}>
                            ${z.fee} DOP
                          </span>
                          {isSelectedZone && (
                            <span className="text-[8px] uppercase font-bold text-emerald-400 block">
                              ● Tu zona
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[10px] text-purple-200">
                  ⚡ <strong>Cálculo automático:</strong> Cada 1.5 km suma $25 DOP de forma exacta e inmediata.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Destination Zone Badge */}
      {selectedDeliveryCalc && (
        <div className="absolute top-14 left-3 z-10 bg-neutral-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-cyan-500/40 shadow-xl flex items-center gap-2 text-xs text-white max-w-[280px] sm:max-w-xs animate-in fade-in">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: selectedDeliveryCalc.zone.color }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-black text-white text-[11px] truncate">
                {selectedDeliveryCalc.zone.shortLabel}
              </span>
              <span className="text-[10px] text-neutral-400">({selectedDeliveryCalc.distanceKm.toFixed(1)} km)</span>
            </div>
            <span className="text-[10px] text-cyan-300 font-bold block">
              Tarifa: ${selectedDeliveryCalc.fee} DOP • Calculado al instante
            </span>
          </div>
        </div>
      )}

      {/* TOP RIGHT: Floating Map Controls (Fit, Store, GPS, Expand) */}
      {showAllControls && (
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
          {/* Expand/Collapse Map */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Contraer mapa' : 'Ampliar mapa'}
            className="p-2.5 bg-neutral-900/90 hover:bg-neutral-800 text-white rounded-xl shadow-lg border border-neutral-700/80 backdrop-blur transition-all active:scale-95 cursor-pointer"
            aria-label="Expandir o contraer mapa"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-amber-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-neutral-300" />
            )}
          </button>

          {/* Fit all points */}
          <button
            type="button"
            onClick={fitAll}
            title="Ajustar y ver toda la ruta"
            className="p-2.5 bg-neutral-900/90 hover:bg-neutral-800 text-white rounded-xl shadow-lg border border-neutral-700/80 backdrop-blur transition-all active:scale-95 cursor-pointer"
            aria-label="Ver mapa completo"
          >
            <Layers className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Center Store */}
          <button
            type="button"
            onClick={centerStore}
            title="Centrar en Tienda Física"
            className="p-2.5 bg-neutral-900/90 hover:bg-neutral-800 text-white rounded-xl shadow-lg border border-neutral-700/80 backdrop-blur transition-all active:scale-95 cursor-pointer"
            aria-label="Ubicar Tienda Física"
          >
            <Store className="w-4 h-4 text-violet-400" />
          </button>

          {/* Center Target if exists */}
          {selectedLocation && (
            <button
              type="button"
              onClick={centerSelected}
              title="Centrar en Destino"
              className="p-2.5 bg-neutral-900/90 hover:bg-neutral-800 text-white rounded-xl shadow-lg border border-neutral-700/80 backdrop-blur transition-all active:scale-95 cursor-pointer"
              aria-label="Centrar en Destino"
            >
              <Crosshair className="w-4 h-4 text-emerald-400" />
            </button>
          )}

          {/* Geolocation */}
          {onSelectLocation && (
            <button
              type="button"
              onClick={handleGeolocate}
              title="Mi Ubicación GPS"
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 border border-emerald-400/50 backdrop-blur transition-all active:scale-95 cursor-pointer"
              aria-label="Mi Ubicación GPS"
            >
              <Navigation className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      )}

      {/* BOTTOM INFO BAR: Street Route Details Badge (Real street tracing) */}
      {streetRouteInfo && streetRouteInfo.coordinates.length > 1 && (
        <div className="absolute bottom-3 right-3 z-10 bg-neutral-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-neutral-700/80 text-xs text-white shadow-2xl flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <Route className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 font-black text-xs text-white">
              <span>Ruta por Calles:</span>
              <span className="text-emerald-400">{streetRouteInfo.distanceKm} km</span>
              <span className="text-neutral-500">•</span>
              <span className="text-cyan-400">~{streetRouteInfo.durationMinutes} min</span>
            </div>
            <span className="text-[10px] text-neutral-400 block">
              {streetRouteInfo.isRealStreet
                ? '🛣️ Siguiendo trazado vial y esquinas reales'
                : '🛣️ Trazado vehicular calibrado'}
            </span>
          </div>
        </div>
      )}

      {/* Drag Hint Pill */}
      {onSelectLocation && isDraggableTarget && (
        <div className="absolute bottom-3 left-3 z-10 bg-neutral-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-700/80 text-[11px] text-neutral-300 shadow flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Toca el mapa o arrastra el pin para fijar la entrega</span>
        </div>
      )}
    </div>
  );
};
