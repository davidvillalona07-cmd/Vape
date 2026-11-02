import React from 'react';
import { Order, OrderItem } from '../../types';
import { Clock, RotateCcw, Calendar, CheckCircle2, ShoppingBag } from 'lucide-react';

interface OrderHistorySectionProps {
  orders: Order[];
  onRepeatOrder: (items: OrderItem[]) => void;
  onGoToShop: () => void;
}

export const OrderHistorySection: React.FC<OrderHistorySectionProps> = ({
  orders,
  onRepeatOrder,
  onGoToShop,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Clock className="w-4 h-4" />
              <span>Compras Anteriores</span>
            </div>
            <h2 className="text-xl font-black text-white">Historial de Pedidos Realizados</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Consulta tus pedidos anteriores de líquidos y repite compras con un solo clic.
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToShop}
            className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Ir a la Tienda</span>
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm">
              <p>Aún no has registrado pedidos.</p>
              <button
                type="button"
                onClick={onGoToShop}
                className="mt-3 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Hacer mi primer pedido</span>
                <span>🛵</span>
              </button>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700/80 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-black text-white">Pedido #{order.id}</span>
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.createdAt).toLocaleDateString()} a las{' '}
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full inline-block ${
                      order.status === 'entregado'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : order.status === 'cancelado'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1.5 divide-y divide-neutral-900 text-xs">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center pt-1.5 first:pt-0">
                      <span className="text-neutral-300">
                        <strong className="text-emerald-400">{it.quantity}x</strong> {it.productName}{' '}
                        <span className="text-neutral-500 text-[11px]">
                          ({it.portion === 'tanque_lleno' ? 'Tanque Lleno' : 'Mitad'})
                        </span>
                      </span>
                      <span className="font-semibold text-white">
                        ${it.unitPrice * it.quantity} DOP
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-neutral-400">Total pagado: </span>
                    <strong className="text-sm text-emerald-400">${order.totalAmount} DOP</strong>
                    <span className="text-[11px] text-neutral-500 ml-1.5">
                      (Envío: ${order.deliveryFee} DOP)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRepeatOrder(order.items)}
                    className="py-2 px-4 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Repetir este pedido</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
