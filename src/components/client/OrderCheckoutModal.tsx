import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { Coordinates, OrderItem, StoreConfig, Order, PaymentMethod, UserAccount } from '../../types';
import { MapView } from '../MapView';
import { calculateDistanceKm, calculateDeliveryFee, DELIVERY_ZONES } from '../../utils/routing';
import {
  getStoredClientContact,
  saveClientContact,
  playNotificationSound,
} from '../../utils/storage';
import {
  reverseGeocode,
  getHighAccuracyGPS,
  SANTO_DOMINGO_SECTORS,
  findNearestSector,
  SectorItem,
} from '../../utils/geocoding';
import { buildFullCartWhatsAppMessage, generateWhatsAppLink } from '../../utils/whatsapp';
import {
  MapPin,
  Phone,
  User,
  X,
  AlertCircle,
  Sparkles,
  Banknote,
  CreditCard,
  Building2,
  Copy,
  CheckCircle,
  MessageSquare,
  Navigation,
  Compass,
  Search,
  Check,
  Layers,
  ArrowRight,
  Flame,
  MessageCircle,
} from 'lucide-react';

interface OrderCheckoutModalProps {
  items: OrderItem[];
  store: StoreConfig;
  onClose: () => void;
  onSubmitOrder: (order: Order) => void;
  currentUser?: UserAccount | null;
  onOpenAuth?: () => void;
}

export const OrderCheckoutModal: React.FC<OrderCheckoutModalProps> = ({
  items,
  store,
  onClose,
  onSubmitOrder,
  currentUser,
  onOpenAuth,
}) => {
  const savedContact = getStoredClientContact();
  const [customerName, setCustomerName] = useState(currentUser?.name || savedContact.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || savedContact.phone || '');

  // Address inputs
  const [addressStreet, setAddressStreet] = useState('');
  const [addressApartment, setAddressApartment] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashOption, setCashOption] = useState<'exacto' | '200' | '500' | '1000' | 'otro'>('exacto');
  const [customCash, setCustomCash] = useState<string>('');
  const [copiedBank, setCopiedBank] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Location State
  const [location, setLocation] = useState<Coordinates>(() => {
    return store.location || { lat: 19.41688, lng: -71.61287 };
  });
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  // Location Selection Mode Tab: 'gps' | 'sectores' | 'buscar'
  const [locationTab, setLocationTab] = useState<'gps' | 'sectores' | 'buscar'>('gps');
  const [sectorSearch, setSectorSearch] = useState('');
  const [detectedAddress, setDetectedAddress] = useState<string>(
    store.addressText || 'Colmado Noadia, Loma de Cabrera'
  );
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Auto-reverse geocode whenever coordinates change
  useEffect(() => {
    let active = true;
    setIsResolvingAddress(true);
    reverseGeocode(location)
      .then((addr) => {
        if (active) {
          setDetectedAddress(addr);
          setIsResolvingAddress(false);
        }
      })
      .catch(() => {
        if (active) setIsResolvingAddress(false);
      });

    return () => {
      active = false;
    };
  }, [location.lat, location.lng]);

  // High-accuracy GPS trigger
  const handleRequestGPS = async () => {
    setIsLocating(true);
    setGpsStatus({
      type: 'idle',
      message: '🛰️ Obteniendo coordenadas satelitales de alta precisión...',
    });

    try {
      const result = await getHighAccuracyGPS();
      setLocation(result.coords);
      setAccuracyMeters(result.accuracyMeters);
      setIsLocating(false);
      setGpsStatus({
        type: 'success',
        message: `Ubicación GPS fijada con precisión de ±${result.accuracyMeters} metros.`,
      });
      playNotificationSound('pop');
    } catch (err: any) {
      setIsLocating(false);
      setGpsStatus({
        type: 'error',
        message: err.message || 'No se pudo obtener la ubicación GPS.',
      });
    }
  };

  // Distance & Strict 1.5 km = $25 DOP Delivery Calculation
  const distanceKm = calculateDistanceKm(store.location, location);
  const deliveryCalc = calculateDeliveryFee(distanceKm);
  const deliveryFee = deliveryCalc.fee;

  const subtotalLiquid = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const liquidCostTotal = items.reduce((sum, it) => sum + it.costPrice * it.quantity, 0);
  const immediateTotal = subtotalLiquid + deliveryFee;

  // Cash change calculation
  let cashGiven: number | undefined = undefined;
  let changeDue: number | undefined = undefined;

  if (paymentMethod === 'efectivo') {
    if (cashOption === 'exacto') {
      cashGiven = immediateTotal;
      changeDue = 0;
    } else if (cashOption === '200') {
      cashGiven = 200;
      changeDue = Math.max(0, 200 - immediateTotal);
    } else if (cashOption === '500') {
      cashGiven = 500;
      changeDue = Math.max(0, 500 - immediateTotal);
    } else if (cashOption === '1000') {
      cashGiven = 1000;
      changeDue = Math.max(0, 1000 - immediateTotal);
    } else if (cashOption === 'otro') {
      const parsed = parseFloat(customCash);
      if (!isNaN(parsed) && parsed > 0) {
        cashGiven = parsed;
        changeDue = Math.max(0, parsed - immediateTotal);
      }
    }
  }

  // Filter sectors
  const filteredSectors = useMemo(() => {
    if (!sectorSearch.trim()) return SANTO_DOMINGO_SECTORS;
    const q = sectorSearch.toLowerCase().trim();
    return SANTO_DOMINGO_SECTORS.filter((s) => s.name.toLowerCase().includes(q));
  }, [sectorSearch]);

  const handleSelectSector = (sector: SectorItem) => {
    setLocation({ lat: sector.lat, lng: sector.lng });
    setAccuracyMeters(null);
    setGpsStatus({
      type: 'success',
      message: `Sector fijado en ${sector.name}. Puedes mover el pin sobre el mapa para ajustar a tu puerta.`,
    });
    playNotificationSound('pop');
  };

  const handleCopyBank = () => {
    const text =
      store.bankAccountInfo ||
      'Banreservas Cta Corriente: 960-441209-1 • Titular: BLACK VAPE SRL';
    navigator.clipboard.writeText(text);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage('Por favor ingresa tu nombre para que el delivery pueda identificarte.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 7) {
      setErrorMessage(
        'El número de teléfono es obligatorio para que el delivery pueda llamarte al llegar.'
      );
      return;
    }
    if (!addressStreet.trim()) {
      setErrorMessage(
        'Por favor ingresa tu Calle y Número o Nombre de Edificio para la entrega.'
      );
      return;
    }

    setErrorMessage('');
    saveClientContact({ name: customerName.trim(), phone: customerPhone.trim() });

    // Build comprehensive address note for the delivery driver
    const fullAddressParts = [
      addressStreet.trim(),
      addressApartment.trim() ? `Apto/Piso: ${addressApartment.trim()}` : null,
      addressReference.trim() ? `(Ref: ${addressReference.trim()})` : null,
      `[Zona: ${detectedAddress}]`,
    ]
      .filter(Boolean)
      .join(' • ');

    const newOrder: Order = {
      id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      customerId: currentUser?.role === 'comprador' ? currentUser.id : undefined,
      orderType: 'standard',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddressNote: fullAddressParts,
      specialNotes: specialNotes.trim() || undefined,
      paymentMethod,
      cashGiven,
      changeDue,
      location,
      items,
      subtotalLiquid,
      liquidCostTotal,
      deliveryFee,
      totalAmount: immediateTotal,
      status: 'pendiente_cotizacion',
      statusHistory: [
        {
          status: 'pendiente_cotizacion',
          timestamp: new Date().toISOString(),
          note: `Pedido enviado (${paymentMethod.toUpperCase()}) para recarga de líquidos. Tarifa calculada: $${deliveryFee} DOP (${distanceKm} km, ${deliveryCalc.rateRule}).`,
        },
      ],
    };

    playNotificationSound('alert');
    onSubmitOrder(newOrder);
  };

  const handleWhatsAppOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage('Por favor ingresa tu nombre');
      return;
    }

    saveClientContact({
      name: customerName.trim(),
      phone: customerPhone.trim(),
    });

    const parsedCash = parseFloat(customCash);
    const resolvedCashGiven =
      paymentMethod === 'efectivo' && !isNaN(parsedCash) && parsedCash >= immediateTotal
        ? parsedCash
        : undefined;
    const resolvedChangeDue = resolvedCashGiven ? resolvedCashGiven - immediateTotal : undefined;

    const orderId = `ORD-${Math.floor(100 + Math.random() * 900)}`;

    const fullAddressParts = [
      addressStreet.trim(),
      addressApartment.trim() ? `Apto/Piso: ${addressApartment.trim()}` : null,
      addressReference.trim() ? `(Ref: ${addressReference.trim()})` : null,
      `[Zona: ${detectedAddress}]`,
    ]
      .filter(Boolean)
      .join(' • ');

    const newOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddressNote: fullAddressParts || detectedAddress,
      location,
      items,
      paymentMethod,
      cashGiven: resolvedCashGiven,
      changeDue: resolvedChangeDue,
      specialNotes: specialNotes.trim() || undefined,
      subtotalLiquid,
      liquidCostTotal,
      deliveryFee,
      totalAmount: immediateTotal,
      status: 'pendiente_cotizacion',
      statusHistory: [
        {
          status: 'pendiente_cotizacion',
          timestamp: new Date().toISOString(),
          note: `Pedido enviado vía WhatsApp (${paymentMethod.toUpperCase()}) para recarga de líquidos. Tarifa: $${deliveryFee} DOP.`,
        },
      ],
    };

    playNotificationSound('vape-hit');
    onSubmitOrder(newOrder);

    const waMsg = buildFullCartWhatsAppMessage({
      orderId: newOrder.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddress: fullAddressParts || detectedAddress,
      location,
      items: items.map((it) => ({
        productName: it.productName,
        portion: it.portion,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
      })),
      subtotalLiquid,
      deliveryFee,
      totalAmount: immediateTotal,
      paymentMethod,
      cashGiven: resolvedCashGiven,
      changeDue: resolvedChangeDue,
      specialNotes: specialNotes.trim() || undefined,
      storeName: store.name,
      storeAddress: store.addressText,
    });

    const targetPhone = store.whatsapp || store.phone || '8092104901';
    const waUrl = generateWhatsAppLink(targetPhone, waMsg);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-xl overflow-y-auto font-urban">
      <div className="relative w-full max-w-3xl bg-[#0d0918]/95 border-2 border-purple-500/50 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-purple-950 text-neutral-100 my-auto">
        {/* Header with BLACK VAPE Brand */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-900/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-purple-600 via-cyan-400 to-purple-500 shadow-lg shadow-purple-600/40 shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center">
                <img
                  src="/logo-black-vape.jpeg"
                  alt="BLACK VAPE"
                  className="w-full h-full object-cover scale-105"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-white font-urban tracking-wider text-glow-purple">
                  BLACK VAPE
                </span>
                <span className="text-[10px] uppercase font-tag tracking-wider px-2.5 py-0.5 rounded-md bg-purple-900/50 border border-purple-500/50 text-purple-300">
                  ENTREGA CALLEJERA
                </span>
              </div>
              <p className="text-xs text-neutral-300 font-medium">
                Paso 2 • Confirma tu Ubicación Exacta & Detalles de Recarga
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 text-neutral-400 hover:text-white transition-all cursor-pointer border border-purple-800/40"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-red-950/70 border border-red-800/80 rounded-2xl text-red-200 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* SECTION 1: UBICACIÓN ULTRA-PRECISA */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                    📍
                  </span>
                  <span>¿Dónde te llevamos la recarga?</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Elige tu método preferido para fijar tu dirección con total precisión:
                </p>
              </div>

              {/* Location Tabs Switcher */}
              <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setLocationTab('gps')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    locationTab === 'gps'
                      ? 'bg-emerald-500 text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>GPS Satelital</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationTab('sectores')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    locationTab === 'sectores'
                      ? 'bg-emerald-500 text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Por Sector</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationTab('buscar')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    locationTab === 'buscar'
                      ? 'bg-emerald-500 text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar Lugar</span>
                </button>
              </div>
            </div>

            {/* TAB 1: GPS BUTTON & STATUS */}
            {locationTab === 'gps' && (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRequestGPS}
                    disabled={isLocating}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLocating ? (
                      <>
                        <span className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        <span>Detectando coordenadas GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4 fill-neutral-950" />
                        <span>🎯 Usar Mi Ubicación GPS Actual (Alta Precisión)</span>
                      </>
                    )}
                  </button>
                </div>

                {gpsStatus.message && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 ${
                      gpsStatus.type === 'error'
                        ? 'bg-red-950/60 border border-red-800/80 text-red-200'
                        : gpsStatus.type === 'success'
                        ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-200'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-300'
                    }`}
                  >
                    {gpsStatus.type === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span>{gpsStatus.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SECTORES RAPIDOS */}
            {locationTab === 'sectores' && (
              <div className="space-y-2">
                <p className="text-[11px] text-neutral-400 font-medium">
                  Toca tu sector en Santo Domingo para centrar el mapa al instante:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {SANTO_DOMINGO_SECTORS.filter((s) => s.category === 'sector').map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleSelectSector(sec)}
                      className="px-2.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-left text-xs font-semibold text-neutral-200 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate">{sec.name}</span>
                      {sec.badge && (
                        <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          {sec.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: BUSCAR LUGAR O PLAZA */}
            {locationTab === 'buscar' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={sectorSearch}
                    onChange={(e) => setSectorSearch(e.target.value)}
                    placeholder="Escribe sector, plaza o avenida (ej: Bella Vista, BlueMall, Gazcue)..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {filteredSectors.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleSelectSector(sec)}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-left text-xs font-semibold text-neutral-200 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate">{sec.name}</span>
                      {sec.badge && (
                        <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                          {sec.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Map with High-Zoom & Draggable Pin */}
            <div className="space-y-1.5 pt-1">
              <MapView
                store={store}
                selectedLocation={location}
                onSelectLocation={(coords) => {
                  setLocation(coords);
                  setAccuracyMeters(null);
                }}
                isDraggableTarget={true}
                targetLabel="Entrega BLACK VAPE"
                heightClass="h-56 sm:h-64"
                flyToSelectedOnChange={true}
                accuracyRadiusMeters={accuracyMeters || undefined}
              />
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 px-1">
                <span>💡</span>
                <span>
                  <strong>Tip de precisión:</strong> Puedes arrastrar el pin rojo sobre el mapa o tocar la entrada exacta de tu edificio.
                </span>
              </p>
            </div>

            {/* Immediate Delivery Calculation & Distance/Zone Breakdown Card */}
            <div className="p-3.5 bg-neutral-900/95 rounded-2xl border border-cyan-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border"
                  style={{
                    backgroundColor: `${deliveryCalc.zone.color}20`,
                    borderColor: `${deliveryCalc.zone.color}60`,
                    color: deliveryCalc.zone.color,
                  }}
                >
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded border"
                      style={{
                        backgroundColor: `${deliveryCalc.zone.color}20`,
                        borderColor: `${deliveryCalc.zone.color}60`,
                        color: deliveryCalc.zone.color,
                      }}
                    >
                      {deliveryCalc.zone.shortLabel}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      (Cada 1.5 km = $25 DOP)
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white truncate max-w-sm sm:max-w-md mt-0.5">
                    {isResolvingAddress ? 'Identificando dirección...' : detectedAddress}
                  </p>
                </div>
              </div>

              {/* Immediate metric pills */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start shrink-0 bg-neutral-950 px-3.5 py-2 rounded-xl border border-neutral-800 text-xs">
                <div>
                  <span className="text-[9px] text-neutral-400 block font-medium">Distancia</span>
                  <span className="font-black text-cyan-400">{distanceKm} km</span>
                </div>
                <div className="w-px h-6 bg-neutral-800" />
                <div>
                  <span className="text-[9px] text-neutral-400 block font-medium">Envío</span>
                  <span className="font-black" style={{ color: deliveryCalc.zone.color }}>
                    ${deliveryFee} DOP
                  </span>
                </div>
                <div className="w-px h-6 bg-neutral-800" />
                <div>
                  <span className="text-[9px] text-neutral-400 block font-medium">Total Inmediato</span>
                  <span className="font-black text-emerald-400 text-sm">
                    ${immediateTotal} DOP
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: DATOS DEL COMPRADOR Y DIRECCIÓN DETALLADA */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-neutral-800 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs">
                👤
              </span>
              <span>Datos del Comprador & Entrega</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Tu Nombre Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carlos Gómez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Teléfono de Contacto (Para que el delivery te llame) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="Ej: 809-555-0123"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Address fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Calle y Número o Nombre de Torre / Edificio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Calle Federico Geraldino #45, Torre Bella Mar"
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Apto / Piso / Casa
                </label>
                <input
                  type="text"
                  placeholder="Ej: Apto 4-B, Piso 4"
                  value={addressApartment}
                  onChange={(e) => setAddressApartment(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Punto de Referencia para el Repartidor (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Frente al Colmado Don Juan, portón negro con timbre blanco"
                value={addressReference}
                onChange={(e) => setAddressReference(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* SECTION 3: METODO DE PAGO */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3.5">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-neutral-800 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                💵
              </span>
              <span>Método de Pago para tu Recarga</span>
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('efectivo')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'efectivo'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span className="text-xs font-bold">Efectivo</span>
                <span className="text-[9px] text-neutral-500">Contra entrega</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('transferencia')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'transferencia'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-md'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs font-bold">Transferencia</span>
                <span className="text-[9px] text-neutral-500">Bancos / Qik</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('tarjeta')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'tarjeta'
                    ? 'bg-violet-500/10 border-violet-500 text-violet-400 shadow-md'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">Tarjeta / Link</span>
                <span className="text-[9px] text-neutral-500">Verifone / Enlace</span>
              </button>
            </div>

            {paymentMethod === 'efectivo' && (
              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-2 text-xs">
                <span className="font-semibold text-neutral-300 block text-[11px]">
                  💵 ¿Con cuánto vas a pagar? (Para que el repartidor lleve cambio):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'exacto', label: 'Monto Exacto' },
                    { id: '200', label: '$200 DOP' },
                    { id: '500', label: '$500 DOP' },
                    { id: '1000', label: '$1,000 DOP' },
                    { id: 'otro', label: 'Otro monto' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCashOption(opt.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        cashOption === opt.id
                          ? 'bg-emerald-500 text-neutral-950 shadow'
                          : 'bg-neutral-950 text-neutral-300 border border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {cashOption === 'otro' && (
                  <div className="pt-1">
                    <input
                      type="number"
                      placeholder="Indica con qué billete vas a pagar (ej: 700)"
                      value={customCash}
                      onChange={(e) => setCustomCash(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                {changeDue !== undefined && changeDue > 0 && (
                  <div className="text-[11px] text-emerald-400 font-bold flex items-center justify-between pt-1 border-t border-neutral-800">
                    <span>Cambio que te devolverá el repartidor:</span>
                    <span>~${changeDue} DOP</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'transferencia' && (
              <div className="p-3.5 bg-neutral-900 rounded-xl border border-cyan-500/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 text-xs">
                    Datos Bancarios para Transferir a BLACK VAPE:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBank}
                    className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-white bg-neutral-950 px-2 py-1 rounded-md border border-neutral-800 cursor-pointer"
                  >
                    {copiedBank ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBank ? '¡Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-300 font-mono bg-neutral-950 p-2 rounded-lg border border-neutral-800/80">
                  {store.bankAccountInfo || 'Banreservas Cta Corriente: 960-441209-1 • Titular: BLACK VAPE SRL'}
                </p>
                <p className="text-[10px] text-neutral-400">
                  Puedes transferir ahora o al momento que llegue el repartidor y mostrarle el comprobante.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 4: RESUMEN DEL PEDIDO */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Resumen de Recarga ({items.length} productos)
            </h4>

            <div className="space-y-1.5 divide-y divide-neutral-900">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs pt-1.5 first:pt-0">
                  <span className="text-neutral-200">
                    <strong className="text-emerald-400">{it.quantity}x</strong> {it.productName}{' '}
                    <span className="text-neutral-500 font-semibold">
                      ({it.portion === 'tanque_lleno' ? 'Tanque Lleno • $100' : 'Mitad de Tanque • $50'})
                    </span>
                  </span>
                  <span className="font-bold text-white">${it.unitPrice * it.quantity} DOP</span>
                </div>
              ))}
            </div>

            {/* Delivery fee line item */}
            <div className="pt-2 border-t border-neutral-800 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-neutral-400">
                <span>Subtotal Recargas:</span>
                <span className="font-bold text-white text-sm">${subtotalLiquid} DOP</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: deliveryCalc.zone.color }}
                  />
                  <span>Delivery ({distanceKm} km • {deliveryCalc.zone.shortLabel}):</span>
                </span>
                <span className="font-bold text-sm" style={{ color: deliveryCalc.zone.color }}>
                  +${deliveryFee} DOP
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono">
                <span>Fórmula de cálculo:</span>
                <span>Cada 1.5 km = $25 DOP</span>
              </div>
            </div>

            {/* Total Inmediato */}
            <div className="p-3 bg-neutral-900 rounded-xl border border-emerald-500/40 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Total Inmediato a Pagar
                </span>
                <span className="text-xs text-neutral-300">
                  (Recargas + Delivery al instante)
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-400">
                  ${immediateTotal} DOP
                </span>
              </div>
            </div>

            {/* Aviso de Puntos Ganados / Fidelización */}
            {currentUser?.role === 'comprador' ? (
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border border-purple-500/50 flex items-center justify-between gap-3 text-xs shadow-md">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-300 shrink-0 animate-pulse" />
                  <div>
                    <span className="font-black text-white font-urban block text-sm">
                      🎁 ¡Ganarás +{Math.floor(subtotalLiquid)} puntos con este pedido!
                    </span>
                    <span className="text-[11px] text-purple-200">
                      Se acreditarán a tu cuenta ({currentUser.name}) automáticamente cuando el repartidor confirme la entrega.
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-purple-900 border border-purple-400/50 text-cyan-300 font-black text-xs shrink-0 font-urban">
                  +{Math.floor(subtotalLiquid)} PTS
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#130d22] border border-purple-900/60 flex items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-white font-bold block">
                      ¿Quieres acumular +{Math.floor(subtotalLiquid)} puntos?
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Inicia sesión para acumular puntos y canjear llenadas gratis.
                    </span>
                  </div>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3 py-1.5 rounded-xl bg-purple-900/70 hover:bg-purple-800 text-cyan-300 font-black text-xs border border-purple-700/60 transition-colors cursor-pointer shrink-0 font-urban"
                  >
                    Entrar / Registrarme
                  </button>
                )}
              </div>
            )}

            {/* Aviso de Modalidad de Recarga */}
            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200 flex items-start gap-2">
              <span className="text-amber-400 text-sm">💧</span>
              <div>
                <strong>Modalidad de Recarga:</strong> Este pedido es para recargar el líquido directamente en el tanque de tu vape. <strong>No se vende ni entrega el frasco o pote entero</strong>. El repartidor de BLACK VAPE dispensará la cantidad exacta al llegar.
              </div>
            </div>

            {/* Sistema de Cálculo Inmediato */}
            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong>Cálculo Inmediato por Distancia:</strong> A {distanceKm} km de la tienda ({store.addressText}), te corresponde el rango <strong>{deliveryCalc.zone.label}</strong> con tarifa fija de <strong>${deliveryFee} DOP</strong>. Sin sorpresas al momento de la entrega.
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleWhatsAppOrder}
              className="py-3.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/60 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/60"
              title="Enviar este pedido completo con fotos y ubicación al WhatsApp de BLACK VAPE"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Pedir por WhatsApp 💬</span>
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 px-5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-neutral-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Pedir en la Web 🛵</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
