import { Product, Order, StoreConfig } from '../types';

export const DEFAULT_STORE: StoreConfig = {
  name: 'BLACK VAPE • Colmado Noadia',
  addressText: 'Colmado Noadia, C98P+QVV, Loma de Cabrera',
  location: { lat: 19.41688, lng: -71.61287 },
  phone: '8092104901',
  whatsapp: '8092104901',
  bankAccountInfo: 'Banreservas Cta Corriente: 960-441209-1 • Titular: BLACK VAPE SRL',
  isOpen: true,
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-horny-ice-mint',
    name: 'Horny Flava Ice Mint Bubblegum',
    flavorCategory: 'Mentolados',
    nicotineMg: 35,
    imageUrl: '/liquidos/horny-flava-ice-mint-bubblegum-120ml-liquids-liquids-melca-distro-605_500x.webp',
    stockUnits: 40,
    costPrice: 20,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Delicioso chicle dulce con una intensa explosión helada de menta glacial.',
    isActive: true,
  },
  {
    id: 'prod-mistiq-melon',
    name: 'Mistiq Flava Melón Ice',
    flavorCategory: 'Frutales',
    nicotineMg: 20,
    imageUrl: '/liquidos/mistiq-flava-melon-120ml-liquids-liquids-melca-distro-899_500x.webp',
    stockUnits: 35,
    costPrice: 22,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Pulpa de melón cantaloupe dulce y jugosa con un toque escarchado característico.',
    isActive: true,
  },
  {
    id: 'prod-pod-juice-energy',
    name: 'Pod Juice Salt Energy Freeze',
    flavorCategory: 'Bebidas',
    nicotineMg: 55,
    imageUrl: '/liquidos/pod-juice-salt-energy-freeze-30ml-55mg-liquids-juice-liquids-melca-distro-438_500x.webp',
    stockUnits: 25,
    costPrice: 25,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Electrizante sabor a bebida energética cítrica con efecto freeze polar intenso.',
    isActive: true,
  },
  {
    id: 'prod-pop-big-apple',
    name: 'Pop Iced Big Apple',
    flavorCategory: 'Frutales',
    nicotineMg: 35,
    imageUrl: '/liquidos/pop-iced-big-apple-100ml-liquids-liquids-pop-vapors-melca-distro-934_500x.webp',
    stockUnits: 30,
    costPrice: 20,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Manzanas rojas y verdes crujientes con un refrescante golpe de frío.',
    isActive: true,
  },
  {
    id: 'prod-pop-blueberry-lemonade',
    name: 'Pop Iced Blueberry Lemonade',
    flavorCategory: 'Bebidas',
    nicotineMg: 35,
    imageUrl: '/liquidos/pop-iced-blueberry-lemonade-100ml-liquids-liquids-pop-vapors-melca-distro-958_500x.webp',
    stockUnits: 28,
    costPrice: 22,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Limonada cítrica recién exprimida mezclada con arándanos y hielo picado.',
    isActive: true,
  },
  {
    id: 'prod-pop-grape',
    name: 'Pop Iced Grape',
    flavorCategory: 'Frutales',
    nicotineMg: 20,
    imageUrl: '/liquidos/pop-iced-grape-100ml-liquids-liquids-pop-vapors-melca-distro-444_500x.webp',
    stockUnits: 32,
    costPrice: 20,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Uvas moradas dulces y jugosas con una frescura estilo slushy helado.',
    isActive: true,
  },
  {
    id: 'prod-pop-mango-dragon-fruit',
    name: 'Pop Iced Mango Dragon Fruit',
    flavorCategory: 'Frutales',
    nicotineMg: 35,
    imageUrl: '/liquidos/pop-iced-mango-dragon-fruit-100ml-liquids-liquids-pop-vapors-melca-distro-892_500x.webp',
    stockUnits: 38,
    costPrice: 22,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Exótica combinación de mango maduro con pitahaya (dragon fruit) y toque ice.',
    isActive: true,
  },
  {
    id: 'prod-pop-mango-strawberry',
    name: 'Pop Iced Mango Strawberry',
    flavorCategory: 'Frutales',
    nicotineMg: 35,
    imageUrl: '/liquidos/pop-iced-mango-strawberry-100ml-liquids-fresa-liquids-pop-vapors-melca-distro-715_500x.webp',
    stockUnits: 30,
    costPrice: 22,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Mango carnoso dulce y fresas silvestres en un torbellino frío.',
    isActive: true,
  },
  {
    id: 'prod-pop-strawberry-watermelon',
    name: 'Pop Iced Strawberry Watermelon',
    flavorCategory: 'Frutales',
    nicotineMg: 50,
    imageUrl: '/liquidos/pop-iced-strawberry-watermelon-100ml-liquids-liquids-pop-vapors-melca-distro-629_500x.webp',
    stockUnits: 26,
    costPrice: 24,
    priceFullTank: 100,
    priceHalfTank: 50,
    description: 'Recarga de tanque: Dúo veraniego de fresa madura y sandía jugosa con cristales de hielo.',
    isActive: true,
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-701',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    customerName: 'Alejandro Medina',
    customerPhone: '809-772-4011',
    deliveryAddressNote: 'Cerca del Parque Central, Loma de Cabrera',
    location: { lat: 19.4245, lng: -71.6152 },
    items: [
      {
        productId: 'prod-horny-ice-mint',
        productName: 'Horny Flava Ice Mint Bubblegum',
        portion: 'tanque_lleno',
        unitPrice: 100,
        costPrice: 20,
        quantity: 1,
      },
      {
        productId: 'prod-pop-strawberry-watermelon',
        productName: 'Pop Iced Strawberry Watermelon',
        portion: 'mitad',
        unitPrice: 50,
        costPrice: 24,
        quantity: 1,
      },
    ],
    subtotalLiquid: 150,
    liquidCostTotal: 44,
    deliveryFee: 50,
    totalAmount: 200,
    status: 'en_camino',
    driverName: 'Marcos Delivery Express',
    driverPhone: '809-881-9922',
    driverLocation: { lat: 19.4190, lng: -71.6135 },
    estimatedMinutes: 6,
    statusHistory: [
      { status: 'pendiente_cotizacion', timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
      { status: 'tarifa_propuesta', timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), note: 'Delivery cotizó $50' },
      { status: 'aprobado_en_preparacion', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { status: 'en_camino', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'ORD-702',
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    customerName: 'Laura Rosario',
    customerPhone: '829-410-8890',
    deliveryAddressNote: 'Sector El Corozo, Loma de Cabrera',
    location: { lat: 19.4125, lng: -71.6180 },
    items: [
      {
        productId: 'prod-pop-blueberry-lemonade',
        productName: 'Pop Iced Blueberry Lemonade',
        portion: 'tanque_lleno',
        unitPrice: 100,
        costPrice: 22,
        quantity: 2,
      },
    ],
    subtotalLiquid: 200,
    liquidCostTotal: 44,
    deliveryFee: 25,
    totalAmount: 225,
    status: 'tarifa_propuesta',
    driverName: 'Marcos Delivery Express',
    driverPhone: '809-881-9922',
    estimatedMinutes: 8,
    statusHistory: [
      { status: 'pendiente_cotizacion', timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString() },
      { status: 'tarifa_propuesta', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), note: 'Delivery propone $25' },
    ],
  },
  {
    id: 'ORD-700',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    customerName: 'David Perez',
    customerPhone: '809-332-1144',
    deliveryAddressNote: 'Barrio Norte / Quisqueya, Loma de Cabrera',
    location: { lat: 19.4280, lng: -71.6140 },
    items: [
      {
        productId: 'prod-pop-mango-dragon-fruit',
        productName: 'Pop Iced Mango Dragon Fruit',
        portion: 'tanque_lleno',
        unitPrice: 100,
        costPrice: 22,
        quantity: 1,
      },
    ],
    subtotalLiquid: 100,
    liquidCostTotal: 22,
    deliveryFee: 25,
    totalAmount: 125,
    status: 'entregado',
    driverName: 'Marcos Delivery Express',
    driverPhone: '809-881-9922',
    statusHistory: [
      { status: 'pendiente_cotizacion', timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
      { status: 'tarifa_propuesta', timestamp: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString() },
      { status: 'aprobado_en_preparacion', timestamp: new Date(Date.now() - 2.6 * 3600 * 1000).toISOString() },
      { status: 'en_camino', timestamp: new Date(Date.now() - 2.2 * 3600 * 1000).toISOString() },
      { status: 'entregado', timestamp: new Date(Date.now() - 1.8 * 3600 * 1000).toISOString() },
    ],
  },
];

const STORAGE_KEYS = {
  AGE_VERIFIED: 'vape_age_verified_v1',
  PRODUCTS: 'vape_products_v2', // bumped to v2 for real 9 liquid images
  ORDERS: 'vape_orders_v2',
  STORE: 'vape_store_config_v1',
  ACTIVE_ROLE: 'vape_active_role_v1',
  CLIENT_CONTACT: 'vape_client_contact_v1',
};

// Cross-tab broadcast channel
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('vape_delivery_channel');
  }
} catch {
  // Graceful fallback if unsupported
}

export function subscribeToSync(callback: () => void): () => void {
  if (!broadcastChannel) return () => {};
  const handler = () => {
    callback();
  };
  broadcastChannel.addEventListener('message', handler);
  return () => {
    broadcastChannel?.removeEventListener('message', handler);
  };
}

export function notifySync(): void {
  try {
    broadcastChannel?.postMessage({ timestamp: Date.now() });
  } catch {
    // Ignore
  }
}

export function getStoredAgeVerified(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.AGE_VERIFIED) === 'true';
}

export function setStoredAgeVerified(val: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AGE_VERIFIED, val ? 'true' : 'false');
}

export function getStoredProducts(): Product[] {
  if (typeof window === 'undefined') return INITIAL_PRODUCTS;
  const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  }
  try {
    const parsed: Product[] = JSON.parse(raw);
    // If the cached items don't have the 9 real liquids from /liquidos/, refresh them
    const hasLiquidosImages = parsed.some((p) => p.imageUrl.startsWith('/liquidos/'));
    if (!hasLiquidosImages || parsed.length < 9) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return parsed;
  } catch {
    return INITIAL_PRODUCTS;
  }
}

export function saveProducts(products: Product[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  notifySync();
}

export function getStoredOrders(): Order[] {
  if (typeof window === 'undefined') return INITIAL_ORDERS;
  const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
    return INITIAL_ORDERS;
  }
  try {
    const parsed: Order[] = JSON.parse(raw);
    // If cached orders have coordinates in Santo Domingo (lat < 19), migrate to Loma de Cabrera
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].location?.lat < 19) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    return parsed;
  } catch {
    return INITIAL_ORDERS;
  }
}

export function saveOrders(orders: Order[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  notifySync();
}

export function getStoredStore(): StoreConfig {
  if (typeof window === 'undefined') return DEFAULT_STORE;
  const raw = localStorage.getItem(STORAGE_KEYS.STORE);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify(DEFAULT_STORE));
    return DEFAULT_STORE;
  }
  try {
    const parsed: StoreConfig = JSON.parse(raw);
    // If store still has old Piantini address, lat < 19, or old phone, migrate to Colmado Noadia and 8092104901
    if (
      !parsed.addressText ||
      parsed.addressText.includes('Piantini') ||
      parsed.location.lat < 19 ||
      parsed.phone === '8095550199' ||
      parsed.whatsapp === '8095550199'
    ) {
      const updated = {
        ...DEFAULT_STORE,
        ...parsed,
        phone: '8092104901',
        whatsapp: '8092104901',
      };
      localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify(updated));
      return updated;
    }
    return parsed;
  } catch {
    return DEFAULT_STORE;
  }
}

export function saveStore(store: StoreConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify(store));
  notifySync();
}

export function getStoredClientContact(): { name: string; phone: string } {
  if (typeof window === 'undefined') return { name: '', phone: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENT_CONTACT);
    return raw ? JSON.parse(raw) : { name: '', phone: '' };
  } catch {
    return { name: '', phone: '' };
  }
}

export function saveClientContact(contact: { name: string; phone: string }): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CLIENT_CONTACT, JSON.stringify(contact));
}

export const setStoredClientContact = saveClientContact;

/**
 * Sound notifications using Web Audio API synthesized tones
 */
export function playNotificationSound(type: 'alert' | 'success' | 'money' | 'pop' | 'vape-hit'): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'vape-hit') {
      // Synthesize realistic warm vape airflow hiss and coil sizzle
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.6));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.7);
      filter.Q.value = 1.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'money') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'pop') {
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Audio context may be blocked before gesture
  }
}
