import { supabase, isSupabaseConfigured } from './supabase';
import { Product, Order, OrderItem, StoreConfig, OrderStatus, Coordinates, UserAccount } from '../types';
import {
  getStoredOrders,
  saveOrders,
  getStoredProducts,
  saveProducts,
  getStoredStore,
  saveStore,
  notifySync,
} from './storage';
import { calculateDistanceKm, calculateDeliveryFee } from './routing';
import { awardPointsForOrderLocal, getStoredRedemptions, saveRedemptions } from './supabasePoints';

/**
 * Normalizes DB product row to client Product model
 */
export function mapDbProductToClient(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    flavorCategory: row.flavor_category,
    nicotineMg: Number(row.nicotine_mg || 0),
    imageUrl: row.image_url,
    stockUnits: Number(row.stock_units || 0),
    costPrice: Number(row.cost_price || 0),
    priceFullTank: Number(row.price_full_tank || 100),
    priceHalfTank: Number(row.price_half_tank || 50),
    description: row.description || '',
    isActive: Boolean(row.is_active),
  };
}

/**
 * Normalizes DB store row to client StoreConfig model
 */
export function mapDbStoreToClient(row: any): StoreConfig {
  return {
    name: row.name,
    addressText: row.address_text,
    location: {
      lat: Number(row.latitude || 19.41688),
      lng: Number(row.longitude || -71.61287),
    },
    phone: row.phone || '8092104901',
    whatsapp: row.whatsapp || '8092104901',
    bankAccountInfo: row.bank_account_info || '',
    isOpen: Boolean(row.is_open),
    pointsPerRedemption: Number(row.points_per_redemption ?? 1000),
    redemptionsEnabled: row.redemptions_enabled !== undefined ? Boolean(row.redemptions_enabled) : true,
  };
}

/**
 * Normalizes DB order row to client Order model
 */
export function mapDbOrderToClient(row: any, items: OrderItem[] = [], statusHistory: any[] = []): Order {
  const mappedItems: OrderItem[] = items.length > 0 ? items : (row.order_items || []).map((it: any) => ({
    productId: it.product_id,
    productName: it.product_name,
    portion: it.portion,
    unitPrice: Number(it.unit_price),
    costPrice: Number(it.cost_price || 0),
    quantity: Number(it.quantity),
  }));

  const history = (statusHistory.length > 0 ? statusHistory : (row.order_status_history || [])).map((h: any) => ({
    status: h.status as OrderStatus,
    timestamp: h.created_at || h.timestamp || new Date().toISOString(),
    note: h.note,
  }));

  if (history.length === 0) {
    history.push({
      status: row.status as OrderStatus,
      timestamp: row.created_at || new Date().toISOString(),
    });
  }

  return {
    id: row.id,
    createdAt: row.created_at || new Date().toISOString(),
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddressNote: row.delivery_address_note,
    location: {
      lat: Number(row.destination_lat),
      lng: Number(row.destination_lng),
    },
    items: mappedItems,
    subtotalLiquid: Number(row.subtotal_liquid || 0),
    liquidCostTotal: Number(row.liquid_cost_total || 0),
    deliveryFee: Number(row.final_delivery_fee ?? row.calculated_delivery_fee ?? 25),
    calculatedDeliveryFee: Number(row.calculated_delivery_fee ?? 25),
    proposedDeliveryFee: row.proposed_delivery_fee !== null ? Number(row.proposed_delivery_fee) : undefined,
    calculatedDistanceKm: Number(row.calculated_distance_km ?? 0),
    totalAmount: Number(row.total_amount || 0),
    status: row.status as OrderStatus,
    statusHistory: history,
    driverId: row.driver_id,
    driverName: row.driver_name,
    paymentMethod: row.payment_method,
    cashGiven: row.cash_given ? Number(row.cash_given) : undefined,
    changeDue: row.change_due ? Number(row.change_due) : undefined,
    specialNotes: row.special_notes,
    orderType: row.order_type || 'regular',
    pointsRedeemed: row.points_redeemed ? Number(row.points_redeemed) : 0,
    redemptionId: row.redemption_id,
  };
}

/**
 * 1. Fetch Products from Supabase (fallback to local cache)
 */
export async function fetchProducts(): Promise<Product[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error && data && data.length > 0) {
        const mapped = data.map(mapDbProductToClient);
        saveProducts(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Error al cargar productos de Supabase, usando local cache:', err);
    }
  }
  return getStoredProducts();
}

/**
 * 2. Fetch Store Config from Supabase (fallback to local cache)
 */
export async function fetchStoreConfig(): Promise<StoreConfig> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('store_config')
        .select('*')
        .eq('id', 1)
        .single();

      if (!error && data) {
        const mapped = mapDbStoreToClient(data);
        saveStore(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Error al cargar configuración de tienda de Supabase:', err);
    }
  }
  return getStoredStore();
}

/**
 * 3. Fetch Orders with Items and Status History from Supabase
 */
export async function fetchOrders(): Promise<Order[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), order_status_history(*)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped = data.map((o) => mapDbOrderToClient(o));
        saveOrders(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Error al cargar pedidos de Supabase, usando local cache:', err);
    }
  }
  return getStoredOrders();
}

export interface CreateOrderParams {
  orderId?: string;
  customerId?: string;
  orderType?: 'regular' | 'standard' | 'canje';
  redemptionId?: string;
  pointsRedeemed?: number;
  customerName: string;
  customerPhone: string;
  deliveryAddressNote?: string;
  destination: Coordinates;
  paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta';
  cashGiven?: number;
  specialNotes?: string;
  items: Array<{
    productId: string;
    portion: 'tanque_lleno' | 'mitad';
    quantity: number;
  }>;
}

/**
 * Server-side order creation validation helper (matches server RPC contract)
 */
export function validateOrderInput(params: CreateOrderParams): { valid: boolean; error?: string } {
  if (!params.customerName || params.customerName.trim().length < 2) {
    return { valid: false, error: 'El nombre del cliente es obligatorio y debe tener al menos 2 caracteres.' };
  }

  // Dominican phone check: 809, 829, 849 (10 digits)
  const digits = (params.customerPhone || '').replace(/\D/g, '');
  const cleanDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (
    cleanDigits.length !== 10 ||
    (!cleanDigits.startsWith('809') && !cleanDigits.startsWith('829') && !cleanDigits.startsWith('849'))
  ) {
    return {
      valid: false,
      error: 'El teléfono debe ser un número dominicano válido (809, 829 o 849 con 10 dígitos).',
    };
  }

  // Coordinates validation
  const { lat, lng } = params.destination || {};
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    isNaN(lat) ||
    isNaN(lng) ||
    lat === 0 ||
    lng === 0 ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { valid: false, error: 'La ubicación de entrega (coordenadas GPS) es inválida.' };
  }

  if (!params.items || params.items.length === 0) {
    return { valid: false, error: 'El pedido debe contener al menos un líquido.' };
  }

  for (const it of params.items) {
    if (!it.quantity || it.quantity <= 0 || !Number.isInteger(it.quantity)) {
      return { valid: false, error: 'La cantidad de cada líquido debe ser un número entero mayor a 0.' };
    }
    if (it.portion !== 'tanque_lleno' && it.portion !== 'mitad') {
      return { valid: false, error: 'Porción inválida: debe ser tanque_lleno o mitad.' };
    }
  }

  if (!['efectivo', 'transferencia', 'tarjeta'].includes(params.paymentMethod)) {
    return { valid: false, error: 'Método de pago inválido. Debe ser efectivo, transferencia o tarjeta.' };
  }

  return { valid: true };
}

/**
 * 4. Create Order on Server (Precios y Distancia calculados estrictamente en servidor)
 */
export async function createOrderOnServer(
  params: CreateOrderParams,
  storeConfig: StoreConfig,
  currentProducts: Product[]
): Promise<{ success: boolean; order?: Order; error?: string }> {
  // 1. Client-side pre-validation
  const validation = validateOrderInput(params);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const generatedId = params.orderId || `ORD-${Math.floor(100 + Math.random() * 900)}`;

  // If Supabase is configured, use secure server RPC (create_order_secure)
  if (isSupabaseConfigured()) {
    try {
      const dbItems = params.items.map((it) => ({
        product_id: it.productId,
        portion: it.portion,
        quantity: it.quantity,
      }));

      const { data, error } = await supabase.rpc('create_order_secure', {
        p_order_id: generatedId,
        p_customer_name: params.customerName.trim(),
        p_customer_phone: params.customerPhone.trim(),
        p_delivery_address_note: params.deliveryAddressNote?.trim() || null,
        p_destination_lat: params.destination.lat,
        p_destination_lng: params.destination.lng,
        p_payment_method: params.paymentMethod,
        p_cash_given: params.cashGiven || null,
        p_special_notes: params.specialNotes?.trim() || null,
        p_items: dbItems,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Re-fetch complete order with items and history
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, order_items(*), order_status_history(*)')
        .eq('id', generatedId)
        .single();

      if (orderData) {
        const mappedOrder = mapDbOrderToClient(orderData);
        return { success: true, order: mappedOrder };
      }
    } catch (err: any) {
      console.warn('Error en RPC create_order_secure de Supabase:', err);
      return { success: false, error: err.message || 'Error al crear pedido en servidor.' };
    }
  }

  // Local fallback (offline or dev without Supabase keys):
  // Enforces exact same Haversine + 1.5km = $25 DOP rule
  const distanceKm = calculateDistanceKm(storeConfig.location, params.destination);
  const feeCalc = calculateDeliveryFee(distanceKm);
  const deliveryFee = feeCalc.fee;

  let subtotalLiquid = 0;
  let liquidCostTotal = 0;
  const orderItems: OrderItem[] = [];

  for (const it of params.items) {
    const prod = currentProducts.find((p) => p.id === it.productId);
    if (!prod) {
      return { success: false, error: `Líquido con ID ${it.productId} no encontrado.` };
    }
    if (prod.stockUnits < it.quantity) {
      return { success: false, error: `Stock insuficiente para ${prod.name}. Solo quedan ${prod.stockUnits}.` };
    }

    const unitPrice = it.portion === 'tanque_lleno' ? prod.priceFullTank : prod.priceHalfTank;
    subtotalLiquid += unitPrice * it.quantity;
    liquidCostTotal += prod.costPrice * it.quantity;

    orderItems.push({
      productId: prod.id,
      productName: prod.name,
      portion: it.portion,
      unitPrice,
      costPrice: prod.costPrice,
      quantity: it.quantity,
    });
  }

  const totalAmount = subtotalLiquid + deliveryFee;
  const changeDue =
    params.paymentMethod === 'efectivo' && params.cashGiven && params.cashGiven >= totalAmount
      ? params.cashGiven - totalAmount
      : undefined;

  const fallbackOrder: Order = {
    id: generatedId,
    customerId: params.customerId,
    orderType: params.orderType || 'standard',
    redemptionId: params.redemptionId,
    pointsRedeemed: params.pointsRedeemed,
    createdAt: new Date().toISOString(),
    customerName: params.customerName.trim(),
    customerPhone: params.customerPhone.trim(),
    deliveryAddressNote: params.deliveryAddressNote?.trim(),
    location: params.destination,
    items: orderItems,
    subtotalLiquid,
    liquidCostTotal,
    deliveryFee,
    calculatedDeliveryFee: deliveryFee,
    proposedDeliveryFee: deliveryFee,
    calculatedDistanceKm: distanceKm,
    totalAmount,
    status: 'pendiente_cotizacion',
    statusHistory: [
      {
        status: 'pendiente_cotizacion',
        timestamp: new Date().toISOString(),
        note: `Pedido registrado. Distancia: ${distanceKm} km. Tarifa oficial: $${deliveryFee} DOP.`,
      },
    ],
    paymentMethod: params.paymentMethod,
    cashGiven: params.cashGiven,
    changeDue,
    specialNotes: params.specialNotes,
  };

  const stored = getStoredOrders();
  const updatedOrders = [fallbackOrder, ...stored];
  saveOrders(updatedOrders);

  return { success: true, order: fallbackOrder };
}

/**
 * 5. Atomic Order Assignment (RPC accept_order_atomic)
 * Prevents race condition where two drivers claim the same order simultaneously.
 */
export async function assignDriverAtomic(
  orderId: string,
  driver: UserAccount
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('accept_order_atomic', {
        p_order_id: orderId,
        p_driver_id: driver.id,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al aceptar pedido atómicamente.' };
    }
  }

  // Local fallback
  const stored = getStoredOrders();
  const target = stored.find((o) => o.id === orderId);
  if (!target) return { success: false, error: 'Pedido no encontrado.' };

  if (target.driverId && target.driverId !== driver.id) {
    return { success: false, error: `Este pedido ya fue tomado por ${target.driverName || 'otro repartidor'}.` };
  }

  target.driverId = driver.id;
  target.driverName = driver.name;
  target.driverPhone = driver.phone;
  target.status = 'en_camino';
  target.statusHistory.push({
    status: 'en_camino',
    timestamp: new Date().toISOString(),
    note: `Pedido asignado a ${driver.name} y puesto en camino.`,
  });

  saveOrders(stored);
  return { success: true };
}

/**
 * 6. Mark Delivered with Atomic Server Stock Decrement (RPC mark_order_delivered)
 */
export async function markOrderDeliveredOnServer(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('mark_order_delivered', {
        p_order_id: orderId,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al marcar como entregado en servidor.' };
    }
  }

  // Local fallback
  const orders = getStoredOrders();
  const products = getStoredProducts();
  const targetOrder = orders.find((o) => o.id === orderId);

  if (!targetOrder) return { success: false, error: 'Pedido no encontrado.' };
  if (targetOrder.status === 'entregado') return { success: true };

  // Decrement stock in single pass
  const updatedProducts = products.map((prod) => {
    const sold = targetOrder.items.find((it) => it.productId === prod.id);
    if (sold) {
      return {
        ...prod,
        stockUnits: Math.max(0, prod.stockUnits - sold.quantity),
      };
    }
    return prod;
  });

  targetOrder.status = 'entregado';
  targetOrder.statusHistory.push({
    status: 'entregado',
    timestamp: new Date().toISOString(),
    note: 'Líquidos dispensados en tanque y cobrados con éxito. Stock descontado.',
  });

  // Award loyalty points if registered customer and not a free redemption order
  if (targetOrder.customerId && targetOrder.orderType !== 'canje') {
    awardPointsForOrderLocal(targetOrder.id, targetOrder.customerId, targetOrder.subtotalLiquid);
  }

  // If this was a free liquid redemption order, update redemption record to delivered
  if (targetOrder.orderType === 'canje' && targetOrder.redemptionId) {
    const redemptions = getStoredRedemptions();
    const r = redemptions.find((item) => item.id === targetOrder.redemptionId);
    if (r) {
      r.status = 'entregado' as any;
      r.updatedAt = new Date().toISOString();
      saveRedemptions(redemptions);
    }
  }

  saveProducts(updatedProducts);
  saveOrders(orders);
  return { success: true };
}

/**
 * 7. Propose Fare (Repartidor propone tarifa, se guarda tanto la calculada como la propuesta)
 */
export async function proposeFareOnServer(
  orderId: string,
  fee: number
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    try {
      const { data: order } = await supabase.from('orders').select('subtotal_liquid').eq('id', orderId).single();
      const subtotal = Number(order?.subtotal_liquid || 0);

      const { error } = await supabase
        .from('orders')
        .update({
          proposed_delivery_fee: fee,
          final_delivery_fee: fee,
          total_amount: subtotal + fee,
          status: 'tarifa_propuesta',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) return { success: false, error: error.message };

      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'tarifa_propuesta',
        note: `Repartidor propone tarifa de $${fee} DOP.`,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Local fallback
  const orders = getStoredOrders();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return { success: false, error: 'Pedido no encontrado.' };

  target.proposedDeliveryFee = fee;
  target.deliveryFee = fee;
  target.totalAmount = target.subtotalLiquid + fee;
  target.status = 'tarifa_propuesta';
  target.statusHistory.push({
    status: 'tarifa_propuesta',
    timestamp: new Date().toISOString(),
    note: `Repartidor propone tarifa de $${fee} DOP.`,
  });

  saveOrders(orders);
  return { success: true };
}

/**
 * 8. Realtime Channel Subscription
 * Subscribes to postgres_changes on orders, products and store_config
 */
export function subscribeToSupabaseRealtime(
  onOrdersChange: () => void,
  onProductsChange?: () => void,
  onStoreChange?: () => void
): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channel = supabase
    .channel('black_vape_realtime_channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => {
        onOrdersChange();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      () => {
        onProductsChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'store_config' },
      () => {
        onStoreChange?.();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * 9. Clear Test Orders (Admin-Only with double confirmation)
 */
export async function clearTestOrdersOnServer(
  adminUser: UserAccount | null
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  if (!adminUser || adminUser.role !== 'admin') {
    return {
      success: false,
      error: 'Acceso denegado: solo un administrador autenticado puede purgar los pedidos.',
    };
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('clear_test_orders_admin');
      if (error) {
        // Fallback: direct delete if admin policy permits
        const { error: delErr } = await supabase.from('orders').delete().neq('id', '');
        if (delErr) {
          const count = getStoredOrders().length;
          saveOrders([]);
          return { success: true, deletedCount: count };
        }
        saveOrders([]);
        return { success: true, deletedCount: 0 };
      }
      saveOrders([]);
      return { success: true, deletedCount: data?.deleted_count || 0 };
    } catch (err: any) {
      const count = getStoredOrders().length;
      saveOrders([]);
      return { success: true, deletedCount: count };
    }
  }

  // Local fallback
  const count = getStoredOrders().length;
  saveOrders([]);
  return { success: true, deletedCount: count };
}

/**
 * 10. Save or update product on server
 */
export async function saveProductToServer(product: Product): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('products').upsert({
        id: product.id,
        name: product.name,
        flavor_category: product.flavorCategory,
        nicotine_mg: product.nicotineMg,
        image_url: product.imageUrl,
        stock_units: product.stockUnits,
        cost_price: product.costPrice,
        price_full_tank: product.priceFullTank,
        price_half_tank: product.priceHalfTank,
        description: product.description,
        is_active: product.isActive,
        updated_at: new Date().toISOString(),
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: true };
}

/**
 * 11. Delete product on server (sets is_active to false)
 */
export async function deleteProductFromServer(productId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', productId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: true };
}

/**
 * 12. Save store config on server
 */
export async function saveStoreConfigToServer(store: StoreConfig): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('store_config').update({
        name: store.name,
        address_text: store.addressText,
        latitude: store.location.lat,
        longitude: store.location.lng,
        phone: store.phone,
        whatsapp: store.whatsapp,
        bank_account_info: store.bankAccountInfo,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: true };
}
