import React, { useState, useEffect, useCallback } from 'react';
import {
  AppSection,
  UserAccount,
  Product,
  Order,
  StoreConfig,
  OrderItem,
  OrderStatus,
  Coordinates,
} from './types';
import {
  getStoredAgeVerified,
  getStoredProducts,
  saveProducts,
  getStoredOrders,
  saveOrders,
  getStoredStore,
  saveStore,
  subscribeToSync,
  playNotificationSound,
} from './utils/storage';
import { getCurrentUser, setCurrentUser } from './utils/auth';
import {
  fetchProducts,
  fetchOrders,
  fetchStoreConfig,
  createOrderOnServer,
  assignDriverAtomic,
  markOrderDeliveredOnServer,
  proposeFareOnServer,
  subscribeToSupabaseRealtime,
} from './utils/supabaseOrders';
import { fetchUserPointsBalance } from './utils/supabasePoints';
import { Navigation } from './components/Navigation';
import { AgeGateModal } from './components/AgeGateModal';
import { StoreCatalog } from './components/client/StoreCatalog';
import { NotificationToast, ToastMessage } from './components/NotificationToast';
import { SmokeOverlay } from './components/effects/SmokeOverlay';
import { Flame, Sparkles, MapPin, Bike, Wind } from 'lucide-react';

// Code-splitting via React.lazy for non-landing views and heavy modules (Leaflet map, Admin, Modals)
const AuthModal = React.lazy(() =>
  import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const OrderCheckoutModal = React.lazy(() =>
  import('./components/client/OrderCheckoutModal').then((m) => ({ default: m.OrderCheckoutModal }))
);
const ClientPointsModal = React.lazy(() =>
  import('./components/client/ClientPointsModal').then((m) => ({ default: m.ClientPointsModal }))
);
const MapaRastreoSection = React.lazy(() =>
  import('./components/client/MapaRastreoSection').then((m) => ({ default: m.MapaRastreoSection }))
);
const OrderHistorySection = React.lazy(() =>
  import('./components/client/OrderHistorySection').then((m) => ({ default: m.OrderHistorySection }))
);
const SellerDashboard = React.lazy(() =>
  import('./components/seller/SellerDashboard').then((m) => ({ default: m.SellerDashboard }))
);

function SectionLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-3.5" />
      <span className="text-sm font-bold text-neutral-200">Cargando sección...</span>
      <span className="text-xs text-neutral-500 mt-0.5">Sincronizando datos en tiempo real</span>
    </div>
  );
}

export default function App() {
  const [ageVerified, setAgeVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return true;
    }
    return getStoredAgeVerified();
  });

  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(getCurrentUser);
  const [currentSection, setCurrentSection] = useState<AppSection>('tienda');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>(getStoredProducts);
  const [orders, setOrders] = useState<Order[]>(getStoredOrders);
  const [store, setStore] = useState<StoreConfig>(getStoredStore);

  // Client view states
  const [activeClientOrderId, setActiveClientOrderId] = useState<string | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<OrderItem[] | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refresh client points from DB or cache
  const refreshCurrentUserPoints = useCallback(async () => {
    if (!currentUser) return;
    const balance = await fetchUserPointsBalance(currentUser.id);
    const updated = { ...currentUser, pointsBalance: balance };
    setCurrentUserState(updated);
    setCurrentUser(updated);
  }, [currentUser]);

  // Load points for logged-in buyer
  useEffect(() => {
    if (currentUser?.id) {
      fetchUserPointsBalance(currentUser.id).then((balance) => {
        if (currentUser.pointsBalance !== balance) {
          const updated = { ...currentUser, pointsBalance: balance };
          setCurrentUserState(updated);
          setCurrentUser(updated);
        }
      });
    }
  }, [currentUser?.id]);

  // Push notification helper
  const addToast = useCallback(
    (title: string, description: string, type: ToastMessage['type'] = 'info') => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, type }]);
    },
    []
  );

  // Fetch initial data from Supabase & Subscribe to Realtime
  useEffect(() => {
    fetchProducts().then(setProducts);
    fetchStoreConfig().then(setStore);
    fetchOrders().then(setOrders);

    const unsubRealtime = subscribeToSupabaseRealtime(
      () => {
        fetchOrders().then(setOrders);
      },
      () => {
        fetchProducts().then(setProducts);
      },
      () => {
        fetchStoreConfig().then(setStore);
      }
    );

    const unsubscribeLocal = subscribeToSync(() => {
      setProducts(getStoredProducts());
      setOrders(getStoredOrders());
      setStore(getStoredStore());
      setCurrentUserState(getCurrentUser());
    });

    return () => {
      unsubRealtime();
      unsubscribeLocal();
    };
  }, []);

  // Update active client order reference
  const clientActiveOrder =
    orders.find((o) => o.id === activeClientOrderId) ||
    orders.find((o) => o.status !== 'entregado' && o.status !== 'cancelado') ||
    null;

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'entregado' && o.status !== 'cancelado'
  ).length;

  // HANDLERS: Client
  const handleStartCheckout = (items: OrderItem[]) => {
    setCheckoutItems(items);
  };

  const handleSubmitOrder = async (newOrder: Order) => {
    const res = await createOrderOnServer(
      {
        orderId: newOrder.id,
        customerId: newOrder.customerId || (currentUser?.role === 'comprador' ? currentUser.id : undefined),
        orderType: newOrder.orderType || 'standard',
        redemptionId: newOrder.redemptionId,
        pointsRedeemed: newOrder.pointsRedeemed,
        customerName: newOrder.customerName,
        customerPhone: newOrder.customerPhone,
        deliveryAddressNote: newOrder.deliveryAddressNote,
        destination: newOrder.location,
        paymentMethod: newOrder.paymentMethod || 'efectivo',
        cashGiven: newOrder.cashGiven,
        specialNotes: newOrder.specialNotes,
        items: newOrder.items.map((it) => ({
          productId: it.productId,
          portion: it.portion,
          quantity: it.quantity,
        })),
      },
      store,
      products
    );

    if (!res.success || !res.order) {
      addToast('Error al registrar pedido', res.error || 'No se pudo crear el pedido.', 'alert');
      return;
    }

    const confirmedOrder = res.order;
    const updated = [confirmedOrder, ...orders.filter((o) => o.id !== confirmedOrder.id)];
    setOrders(updated);
    saveOrders(updated);
    setCheckoutItems(null);
    setActiveClientOrderId(confirmedOrder.id);

    // If current user is buyer, update their contact info
    if (currentUser?.role === 'comprador') {
      const updatedUser = {
        ...currentUser,
        name: confirmedOrder.customerName,
        phone: confirmedOrder.customerPhone,
      };
      setCurrentUserState(updatedUser);
      setCurrentUser(updatedUser);
    }

    // PedidosYa experience: switch to map & tracking automatically
    setCurrentSection('mapa');

    addToast(
      '¡Pedido Solicitado!',
      `Pedido #${confirmedOrder.id} enviado. Tarifa de viaje calculada en servidor: $${confirmedOrder.deliveryFee} DOP.`,
      'success'
    );
  };

  const handleCreateOrder = async (newOrder: Order) => {
    const res = await createOrderOnServer(
      {
        orderId: newOrder.id,
        customerId: newOrder.customerId || (currentUser?.role === 'comprador' ? currentUser.id : undefined),
        orderType: newOrder.orderType || 'standard',
        redemptionId: newOrder.redemptionId,
        pointsRedeemed: newOrder.pointsRedeemed,
        customerName: newOrder.customerName,
        customerPhone: newOrder.customerPhone,
        deliveryAddressNote: newOrder.deliveryAddressNote,
        destination: newOrder.location,
        paymentMethod: newOrder.paymentMethod || 'efectivo',
        cashGiven: newOrder.cashGiven,
        specialNotes: newOrder.specialNotes,
        items: newOrder.items.map((it) => ({
          productId: it.productId,
          portion: it.portion,
          quantity: it.quantity,
        })),
      },
      store,
      products
    );

    if (!res.success || !res.order) {
      addToast('Error al registrar pedido', res.error || 'No se pudo crear el pedido.', 'alert');
      return;
    }

    const confirmedOrder = res.order;
    const updated = [confirmedOrder, ...orders.filter((o) => o.id !== confirmedOrder.id)];
    setOrders(updated);
    saveOrders(updated);
    setActiveClientOrderId(confirmedOrder.id);
    playNotificationSound('alert');
    addToast(
      '¡Pedido Registrado!',
      `Pedido #${confirmedOrder.id} enviado con tarifa de $${confirmedOrder.deliveryFee} DOP.`,
      'success'
    );
  };

  const handleApproveFare = (orderId: string) => {
    const updated = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'aprobado_en_preparacion' as OrderStatus,
            statusHistory: [
              ...o.statusHistory,
              {
                status: 'aprobado_en_preparacion' as OrderStatus,
                timestamp: new Date().toISOString(),
                note: 'Cliente aprobó tarifa y recibo.',
              },
            ],
          }
        : o
    );
    setOrders(updated);
    saveOrders(updated);
    addToast(
      'Tarifa Aprobada',
      'El recibo ha sido confirmado. La tienda está preparando tus líquidos.',
      'success'
    );
  };

  const handleRejectOrder = (orderId: string) => {
    const updated = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'cancelado' as OrderStatus,
            statusHistory: [
              ...o.statusHistory,
              {
                status: 'cancelado' as OrderStatus,
                timestamp: new Date().toISOString(),
                note: 'Cliente rechazó tarifa o canceló.',
              },
            ],
          }
        : o
    );
    setOrders(updated);
    saveOrders(updated);
    addToast('Pedido Cancelado', 'Has cancelado la solicitud.', 'alert');
  };

  const handleRepeatOrder = (items: OrderItem[]) => {
    setCheckoutItems(items);
  };

  // HANDLERS: Delivery
  const handleProposeFare = async (orderId: string, fee: number) => {
    await proposeFareOnServer(orderId, fee);
    const updated = orders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          deliveryFee: fee,
          proposedDeliveryFee: fee,
          totalAmount: o.subtotalLiquid + fee,
          status: 'tarifa_propuesta' as OrderStatus,
          statusHistory: [
            ...o.statusHistory,
            {
              status: 'tarifa_propuesta' as OrderStatus,
              timestamp: new Date().toISOString(),
              note: `Delivery propone tarifa de viaje de $${fee} DOP.`,
            },
          ],
        };
      }
      return o;
    });
    setOrders(updated);
    saveOrders(updated);
    addToast(
      'Tarifa Enviada',
      `Propuesta de $${fee} DOP enviada al cliente. Esperando su aprobación.`,
      'info'
    );
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    if (newStatus === 'entregado') {
      const res = await markOrderDeliveredOnServer(orderId);
      if (!res.success) {
        addToast('Error al entregar pedido', res.error || 'No se pudo completar la entrega.', 'alert');
        return;
      }
      fetchProducts().then(setProducts);
      refreshCurrentUserPoints();
    } else if (newStatus === 'en_camino' && currentUser?.role === 'delivery') {
      const res = await assignDriverAtomic(orderId, currentUser);
      if (!res.success) {
        addToast('No se pudo tomar el pedido', res.error || 'Otro repartidor ya tomó este pedido.', 'alert');
        fetchOrders().then(setOrders);
        return;
      }
    }

    const updated = orders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          status: newStatus,
          driverId: newStatus === 'en_camino' && currentUser?.role === 'delivery' ? currentUser.id : o.driverId,
          driverName: newStatus === 'en_camino' && currentUser?.role === 'delivery' ? currentUser.name : o.driverName,
          statusHistory: [
            ...o.statusHistory,
            {
              status: newStatus,
              timestamp: new Date().toISOString(),
              note: note || `Estado actualizado a ${newStatus}`,
            },
          ],
        };
      }
      return o;
    });

    setOrders(updated);
    saveOrders(updated);

    const statusDisplayNames: Record<string, string> = {
      en_camino: 'Repartidor en camino con tus líquidos 🛵',
      llegada_a_destino: '¡El delivery ha llegado a tu ubicación! 📍',
      entregado: 'Pedido entregado y cobrado con éxito ✅',
    };

    if (statusDisplayNames[newStatus]) {
      addToast(
        `Pedido #${orderId}`,
        statusDisplayNames[newStatus],
        newStatus === 'entregado' ? 'success' : 'alert'
      );
    }
  };

  const handleUpdateDriverLocation = (orderId: string, location: Coordinates) => {
    const updated = orders.map((o) =>
      o.id === orderId ? { ...o, driverLocation: location } : o
    );
    setOrders(updated);
    saveOrders(updated);
  };

  // HANDLERS: Seller
  const handleSaveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    saveProducts(newProducts);
    addToast('Catálogo Actualizado', 'Los cambios en los líquidos se han guardado.', 'success');
  };

  const handleSaveStore = (newStore: StoreConfig) => {
    setStore(newStore);
    saveStore(newStore);
    addToast('Tienda Actualizada', 'La configuración del local físico se ha guardado.', 'success');
  };

  const handleClearOrders = () => {
    setOrders([]);
    saveOrders([]);
    setActiveClientOrderId(null);
    addToast('Historial Limpiado', 'Se han eliminado los pedidos de prueba.', 'info');
  };


  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUserState(user);
    setCurrentUser(user);

    // If delivery logs in, take them straight to Mapa & Rastreo (their dispatch hub)
    if (user.role === 'delivery') {
      setCurrentSection('mapa');
    } else if (user.role === 'admin') {
      setCurrentSection('admin');
    } else {
      setCurrentSection('tienda');
    }

    addToast('Sesión Iniciada', `Bienvenido ${user.name} (${user.role})`, 'success');
  };

  const handleLogout = () => {
    setCurrentUserState(null);
    setCurrentUser(null);
    setCurrentSection('tienda');
    addToast('Sesión Finalizada', 'Has cerrado sesión.', 'info');
  };

  return (
    <div className="min-h-screen bg-[#08050e] text-neutral-100 flex flex-col font-urban relative selection:bg-purple-600 selection:text-white">
      {/* Atmospheric Smoke & Live Vape Cloud Simulator */}
      <SmokeOverlay />

      {/* Age Gate 18+ Verification Modal */}
      {!ageVerified && <AgeGateModal onVerified={() => setAgeVerified(true)} />}

      {/* Auth Modal for Role Logins (Lazy Loaded) */}
      <React.Suspense fallback={null}>
        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onAuthSuccess={handleAuthSuccess}
            initialRole={currentUser?.role || 'comprador'}
          />
        )}
      </React.Suspense>

      {/* Push Notifications Toast */}
      <NotificationToast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* PedidosYa Navigation Header & Tab Bar */}
      <Navigation
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        store={store}
        activeOrdersCount={activeOrdersCount}
        onOpenPoints={() => setIsPointsModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 pb-24 sm:p-6 sm:pb-8 lg:p-8 relative z-10">
        {/* SECTION 1: TIENDA (Front-Facing Landing, Just Like PedidosYa - Instant Bundle) */}
        {currentSection === 'tienda' && (
          <div className="space-y-6">
            {/* Fast active order notice banner if any */}
            {clientActiveOrder && (
              <div
                onClick={() => setCurrentSection('mapa')}
                className="bg-[#120924]/90 border-2 border-cyan-400/80 p-4 rounded-3xl cursor-pointer hover:border-cyan-300 transition-all shadow-xl shadow-cyan-950/40 flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 flex items-center justify-center font-bold text-2xl group-hover:scale-105 transition-transform">
                    🛵
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-tag tracking-wider text-cyan-300 block">
                      TIENES UN PEDIDO ACTIVO EN CAMINO
                    </span>
                    <strong className="text-sm text-white font-urban block">
                      Pedido #{clientActiveOrder.id} • Estado: {clientActiveOrder.status.replace(/_/g, ' ').toUpperCase()}
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-black text-cyan-400 group-hover:text-cyan-300">
                  <span>Ver en el mapa</span>
                  <span>➔</span>
                </div>
              </div>
            )}

            {/* Liquid Catalog */}
            <StoreCatalog
              products={products}
              store={store}
              onStartCheckout={handleStartCheckout}
              onCreateOrder={handleCreateOrder}
            />
          </div>
        )}

        {/* SECTION 2: MAPA & RASTREO (Dedicated Live Map View - Lazy Loaded) */}
        {currentSection === 'mapa' && (
          <React.Suspense fallback={<SectionLoadingFallback />}>
            <MapaRastreoSection
              currentUser={currentUser}
              activeOrder={clientActiveOrder}
              orders={orders}
              store={store}
              onApproveFare={handleApproveFare}
              onRejectOrder={handleRejectOrder}
              onNewOrder={() => setActiveClientOrderId(null)}
              onGoToShop={() => setCurrentSection('tienda')}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onProposeFare={handleProposeFare}
              onUpdateDriverLocation={handleUpdateDriverLocation}
            />
          </React.Suspense>
        )}

        {/* SECTION 3: HISTORIAL DE PEDIDOS (Lazy Loaded) */}
        {currentSection === 'pedidos' && (
          <React.Suspense fallback={<SectionLoadingFallback />}>
            <OrderHistorySection
              orders={orders}
              onRepeatOrder={handleRepeatOrder}
              onGoToShop={() => setCurrentSection('tienda')}
            />
          </React.Suspense>
        )}

        {/* SECTION 4: PANEL ADMINISTRADOR (Lazy Loaded) */}
        {currentSection === 'admin' && currentUser?.role === 'admin' && (
          <React.Suspense fallback={<SectionLoadingFallback />}>
            <SellerDashboard
              products={products}
              orders={orders}
              store={store}
              currentUser={currentUser}
              onSaveProducts={handleSaveProducts}
              onSaveStore={handleSaveStore}
              onClearOrders={handleClearOrders}
            />
          </React.Suspense>
        )}
      </main>

      {/* Checkout Modal with Map Pin Drop (Lazy Loaded) */}
      <React.Suspense fallback={null}>
        {checkoutItems && (
          <OrderCheckoutModal
            items={checkoutItems}
            store={store}
            onClose={() => setCheckoutItems(null)}
            onSubmitOrder={handleSubmitOrder}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </React.Suspense>

      {/* Client Loyalty & Points Modal (Lazy Loaded) */}
      <React.Suspense fallback={null}>
        {isPointsModalOpen && currentUser && (
          <ClientPointsModal
            isOpen={isPointsModalOpen}
            onClose={() => setIsPointsModalOpen(false)}
            currentUser={currentUser}
            store={store}
            products={products}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onPointsUpdated={refreshCurrentUserPoints}
          />
        )}
      </React.Suspense>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo-black-vape.jpeg" alt="BLACK VAPE" className="w-4 h-4 rounded-full object-cover" />
            <span className="font-bold text-neutral-300 tracking-wider">BLACK VAPE</span>
            <span>• Venta exclusiva a mayores de 18 años</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400 text-[11px]">
            <span>Local Físico: {store.addressText}</span>
            <span>Tel: {store.phone}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
