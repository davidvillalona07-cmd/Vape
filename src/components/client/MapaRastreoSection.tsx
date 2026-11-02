import React from 'react';
import { Order, StoreConfig, UserAccount, Coordinates } from '../../types';
import { MapView } from '../MapView';
import { ClientActiveOrderView } from './ClientActiveOrderView';
import { DeliveryDashboard } from '../delivery/DeliveryDashboard';
import { DELIVERY_ZONES } from '../../utils/routing';
import { MapPin, ShoppingBag, Store, Phone, Clock, Radar, Sparkles } from 'lucide-react';

interface MapaRastreoSectionProps {
  currentUser: UserAccount | null;
  activeOrder: Order | null;
  orders: Order[];
  store: StoreConfig;
  onApproveFare: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
  onNewOrder: () => void;
  onGoToShop: () => void;
  onUpdateOrderStatus: (orderId: string, newStatus: Order['status'], note?: string) => void;
  onProposeFare: (orderId: string, fee: number) => void;
  onUpdateDriverLocation?: (orderId: string, location: Coordinates) => void;
}

export const MapaRastreoSection: React.FC<MapaRastreoSectionProps> = ({
  currentUser,
  activeOrder,
  orders,
  store,
  onApproveFare,
  onRejectOrder,
  onNewOrder,
  onGoToShop,
  onUpdateOrderStatus,
  onProposeFare,
  onUpdateDriverLocation,
}) => {
  // If logged in as Delivery, show delivery hub directly
  if (currentUser?.role === 'delivery') {
    return (
      <DeliveryDashboard
        orders={orders}
        store={store}
        currentUser={currentUser}
        onUpdateOrderStatus={onUpdateOrderStatus}
        onProposeFare={onProposeFare}
        onUpdateDriverLocation={onUpdateDriverLocation}
      />
    );
  }

  // If buyer has active order, show active order tracking
  if (activeOrder) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Seguimiento en Vivo de tu Pedido</h2>
            <p className="text-xs text-neutral-400">
              Rastreo en tiempo real, cotización de tarifa y contacto telefónico directo.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToShop}
            className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
          >
            Ver más líquidos en Tienda
          </button>
        </div>

        <ClientActiveOrderView
          order={activeOrder}
          store={store}
          onApproveFare={onApproveFare}
          onRejectOrder={onRejectOrder}
          onNewOrder={onNewOrder}
        />
      </div>
    );
  }

  // If no active order, show physical store location map so user knows where the shop is
  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Store className="w-4 h-4" />
              <span>Local Físico de Líquidos & Rangos de Delivery</span>
            </div>
            <h2 className="text-xl font-black text-white font-urban">
              Ubicación del Local & Rangos de Envío a Domicilio
            </h2>
            <p className="text-xs text-neutral-300 mt-1">
              Aquí se encuentra nuestro local en {store.name} ({store.addressText}). En el mapa puedes ver los anillos concéntricos con la tarifa por distancia: <strong>cada 1.5 km = $25 DOP</strong> ($25, $50, $75, $100, etc.).
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToShop}
            className="py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Hacer un Pedido Ahora</span>
          </button>
        </div>

        {/* Store Map with concentric delivery rings */}
        <div className="mt-5">
          <MapView
            store={store}
            selectedLocation={store.location}
            targetLabel="Tienda Central"
            heightClass="h-80 sm:h-96"
            showDeliveryZones={true}
          />
        </div>

        {/* Delivery Radial Zones Legend Strip */}
        <div className="mt-4 p-4 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-urban">
                Rangos Visuales de Entrega a la Redonda del Local
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-800/60 self-start sm:self-auto">
              Regla: Cada 1.5 km = $25 DOP
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {DELIVERY_ZONES.map((zone) => (
              <div
                key={zone.tier}
                className="p-2.5 rounded-xl border bg-black/50 flex flex-col justify-between transition-all hover:border-neutral-600"
                style={{ borderColor: `${zone.color}40` }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: zone.color }}
                  />
                  <span className="text-[11px] font-black font-urban text-white truncate">
                    Zona {zone.tier}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-black block" style={{ color: zone.color }}>
                    ${zone.fee} DOP
                  </span>
                  <span className="text-[10px] text-neutral-400 block font-mono">
                    Hasta {zone.maxKm} km
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Store Information Cards */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
            <span className="text-[10px] text-neutral-400 uppercase font-bold block">
              Dirección del Local
            </span>
            <strong className="text-sm text-white block mt-0.5">{store.addressText}</strong>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                Teléfono de la Tienda
              </span>
              <strong className="text-sm text-white block mt-0.5">{store.phone}</strong>
            </div>
            <a
              href={`tel:${store.phone}`}
              className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              title="Llamar a la tienda"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
            <span className="text-[10px] text-neutral-400 uppercase font-bold block">
              Horario de Reparto
            </span>
            <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Abierto • Entregas inmediatas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
