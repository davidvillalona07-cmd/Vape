import React, { useState, useEffect } from 'react';
import { Product, PortionType, StoreConfig, Coordinates, Order, OrderStatus } from '../../types';
import {
  X,
  MessageCircle,
  MapPin,
  Navigation,
  Sparkles,
  Droplet,
  Plus,
  Minus,
  CheckCircle2,
  Wind,
  Phone,
  User,
  ExternalLink,
} from 'lucide-react';
import { calculateDistanceKm, calculateDeliveryFee } from '../../utils/routing';
import { SANTO_DOMINGO_SECTORS, reverseGeocode, findNearestSector } from '../../utils/geocoding';
import { buildSingleProductWhatsAppMessage, generateWhatsAppLink } from '../../utils/whatsapp';
import { playNotificationSound, getStoredClientContact, setStoredClientContact } from '../../utils/storage';

interface QuickWhatsAppOrderModalProps {
  product: Product;
  store: StoreConfig;
  onClose: () => void;
  onCreateOrder: (order: Order) => void;
}

export const QuickWhatsAppOrderModal: React.FC<QuickWhatsAppOrderModalProps> = ({
  product,
  store,
  onClose,
  onCreateOrder,
}) => {
  const [portion, setPortion] = useState<PortionType>('tanque_lleno');
  const [quantity, setQuantity] = useState<number>(1);

  // Client info
  const initialContact = getStoredClientContact();
  const [customerName, setCustomerName] = useState(initialContact.name || '');
  const [customerPhone, setCustomerPhone] = useState(initialContact.phone || '');
  const [deliveryAddressNote, setDeliveryAddressNote] = useState('');

  // Location state (defaults to store location in Loma de Cabrera)
  const [location, setLocation] = useState<Coordinates>(() => {
    return store.location || { lat: 19.41688, lng: -71.61287 };
  });
  const [isLocating, setIsLocating] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string>('Loma de Cabrera, Dajabón');
  const [errorMessage, setErrorMessage] = useState('');

  const unitPrice = portion === 'tanque_lleno' ? product.priceFullTank : product.priceHalfTank;
  const subtotalLiquid = unitPrice * quantity;
  const distanceKm = calculateDistanceKm(store.location, location);
  const deliveryCalc = calculateDeliveryFee(distanceKm);
  const deliveryFee = deliveryCalc.fee;
  const totalAmount = subtotalLiquid + deliveryFee;

  // Resolve address when coords change
  useEffect(() => {
    let active = true;
    reverseGeocode(location).then((addr) => {
      if (active) setDetectedAddress(addr);
    });
    return () => {
      active = false;
    };
  }, [location]);

  // GPS Request
  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Tu navegador no soporta geolocalización.');
      return;
    }
    setIsLocating(true);
    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        playNotificationSound('pop');
      },
      (err) => {
        setIsLocating(false);
        setErrorMessage('No se pudo obtener el GPS. Puedes seleccionar tu sector abajo.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectSector = (secLat: number, secLng: number, secName: string) => {
    setLocation({ lat: secLat, lng: secLng });
    setDetectedAddress(secName);
    playNotificationSound('pop');
  };

  // Build order object
  const createSystemOrder = (): Order => {
    const orderId = `ORD-${Math.floor(100 + Math.random() * 900)}`;
    const newOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim() || 'Cliente WhatsApp',
      customerPhone: customerPhone.trim() || '809-555-0000',
      deliveryAddressNote: deliveryAddressNote.trim()
        ? `${detectedAddress} (${deliveryAddressNote.trim()})`
        : detectedAddress,
      location,
      items: [
        {
          productId: product.id,
          productName: product.name,
          portion,
          unitPrice,
          costPrice: product.costPrice,
          quantity,
        },
      ],
      subtotalLiquid,
      liquidCostTotal: product.costPrice * quantity,
      deliveryFee,
      totalAmount,
      status: 'pendiente_cotizacion' as OrderStatus,
      paymentMethod: 'efectivo',
      statusHistory: [
        {
          status: 'pendiente_cotizacion' as OrderStatus,
          timestamp: new Date().toISOString(),
          note: `Pedido solicitado vía WhatsApp directo para ${product.name}`,
        },
      ],
    };
    return newOrder;
  };

  const handleSendWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage('Por favor ingresa tu nombre');
      return;
    }

    if (customerName && customerPhone) {
      setStoredClientContact({ name: customerName, phone: customerPhone });
    }

    playNotificationSound('vape-hit');

    // 1. Create order in the local system so delivery drivers receive it!
    const newOrder = createSystemOrder();
    onCreateOrder(newOrder);

    // 2. Generate WhatsApp message with product photo, Google Maps link, and full details
    const msg = buildSingleProductWhatsAppMessage({
      productName: product.name,
      flavorCategory: product.flavorCategory,
      nicotineMg: product.nicotineMg,
      imageUrl: product.imageUrl,
      portion,
      quantity,
      unitPrice,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddress: deliveryAddressNote.trim()
        ? `${detectedAddress} • Nota: ${deliveryAddressNote.trim()}`
        : detectedAddress,
      customerCoords: location,
      storeName: store.name,
      storeAddress: store.addressText,
      deliveryFee,
    });

    const targetPhone = store.whatsapp || store.phone || '8092104901';
    const waUrl = generateWhatsAppLink(targetPhone, msg);

    // Open WhatsApp
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const lomaSectors = SANTO_DOMINGO_SECTORS.slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-urban">
      <div className="relative w-full max-w-lg bg-[#0e0a1a] border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-emerald-950/60 text-white my-auto max-h-[92vh] overflow-y-auto">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-purple-900/40">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </span>
            <div>
              <span className="text-[10px] font-tag uppercase tracking-wider text-emerald-400 block">
                PEDIDO RÁPIDO POR WHATSAPP
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Recarga Express en 1 Clic
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product preview card with photo */}
        <div className="mt-4 p-3.5 rounded-2xl bg-black/70 border border-purple-900/50 flex items-center gap-3.5">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-black shrink-0 border border-purple-800/60 p-1 flex items-center justify-center">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 rounded text-[9px] font-tag bg-purple-900/60 text-purple-300 border border-purple-700/50">
                {product.flavorCategory}
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                {product.nicotineMg}mg
              </span>
            </div>
            <h4 className="font-black text-sm text-white truncate">{product.name}</h4>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              Salida: {store.name} ({store.addressText})
            </p>
          </div>
        </div>

        <form onSubmit={handleSendWhatsApp} className="mt-4 space-y-4">
          {/* Portion Selection */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1.5">
              Selecciona Tamaño de Recarga para tu Tanque:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPortion('tanque_lleno')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  portion === 'tanque_lleno'
                    ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-lg shadow-emerald-950'
                    : 'bg-black/50 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Tanque Lleno</span>
                  <Droplet className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                </div>
                <div className="text-sm font-black text-emerald-400 mt-1">
                  $100 DOP <span className="text-[10px] font-normal text-neutral-400">(100%)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPortion('mitad')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  portion === 'mitad'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-lg shadow-cyan-950'
                    : 'bg-black/50 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Mitad Tanque</span>
                  <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-sm font-black text-cyan-400 mt-1">
                  $50 DOP <span className="text-[10px] font-normal text-neutral-400">(50%)</span>
                </div>
              </button>
            </div>
          </div>

          {/* Quantity stepper */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/60 border border-neutral-800">
            <div>
              <span className="text-xs font-bold text-white block">Cantidad de Tanques:</span>
              <span className="text-[11px] text-neutral-400">
                ${unitPrice} DOP c/u = ${subtotalLiquid} DOP
              </span>
            </div>
            <div className="flex items-center gap-2 bg-[#120c22] border border-purple-800/60 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors font-black text-sm"
              >
                -
              </button>
              <span className="text-sm font-black text-white px-2 min-w-[24px] text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors font-black text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Tu Nombre *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ej: Alejandro Medina"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-black/70 border border-neutral-800 rounded-xl py-2 px-3 pl-8 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <User className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Teléfono / WhatsApp *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="Ej: 809-555-0199"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-black/70 border border-neutral-800 rounded-xl py-2 px-3 pl-8 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <Phone className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Location picker */}
          <div className="p-3.5 rounded-2xl bg-black/70 border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>¿Dónde te llevamos la recarga?</span>
              </span>
              <button
                type="button"
                onClick={handleGetGPS}
                disabled={isLocating}
                className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/50 text-[11px] font-bold text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Obteniendo GPS...' : 'Usar mi GPS'}</span>
              </button>
            </div>

            {/* Quick sectors chips in Loma de Cabrera */}
            <div>
              <span className="text-[10px] text-neutral-400 block mb-1">
                Sectores comunes en Loma de Cabrera:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-none">
                {lomaSectors.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSelectSector(sec.lat, sec.lng, sec.name)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer border ${
                      detectedAddress.includes(sec.name)
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Direction note */}
            <div>
              <input
                type="text"
                placeholder="Punto de referencia o casa (Ej: Casa azul frente al parque)"
                value={deliveryAddressNote}
                onChange={(e) => setDeliveryAddressNote(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Location & Delivery Fee Breakdown */}
            <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-[11px] text-neutral-300 space-y-1">
              <div className="flex justify-between">
                <span>Distancia desde Colmado Noadia:</span>
                <span className="font-bold text-cyan-400">{distanceKm} km</span>
              </div>
              <div className="flex justify-between">
                <span>Tarifa Delivery ({deliveryCalc.zone.shortLabel}):</span>
                <span className="font-bold text-emerald-400">${deliveryFee} DOP</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-neutral-800 text-xs font-black text-white">
                <span>TOTAL A PAGAR:</span>
                <span className="text-emerald-400 font-urban text-sm">${totalAmount} DOP</span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl shadow-emerald-950/80 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Enviar Pedido a WhatsApp de BLACK VAPE</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
