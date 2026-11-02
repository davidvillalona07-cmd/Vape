import React from 'react';
import { Order, OrderItem } from '../../types';
import { History, X, RotateCcw, Calendar, CheckCircle2, Phone, MapPin } from 'lucide-react';

interface OrderHistoryModalProps {
  orders: Order[];
  onClose: () => void;
  onRepeatOrder: (items: OrderItem[]) => void;
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({
  orders,
  onClose,
  onRepeatOrder,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-neutral-100 my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Historial de Pedidos</h2>
              <p className="text-xs text-neutral-400">Tus compras anteriores de líquidos y entregas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
            aria-label="Cerrar historial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 max-h-[60vh] overflow-y-auto space-y-4 pr-1">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-sm">
              No tienes pedidos registrados todavía.
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700/80 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">{order.id}</span>
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleDateString()} •{' '}
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
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

                <div className="space-y-1 divide-y divide-neutral-900 text-xs">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center pt-1 first:pt-0">
                      <span className="text-neutral-300">
                        <strong className="text-emerald-400">{it.quantity}x</strong>{' '}
                        {it.productName}{' '}
                        <span className="text-neutral-500">
                          ({it.portion === 'tanque_lleno' ? 'Tanque Lleno' : 'Mitad'})
                        </span>
                      </span>
                      <span className="font-semibold text-neutral-300">
                        ${it.unitPrice * it.quantity} DOP
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-400">Total pagado: </span>
                    <strong className="text-sm text-emerald-400">${order.totalAmount} DOP</strong>
                    <span className="text-[10px] text-neutral-500 ml-1">
                      (envío ${order.deliveryFee})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onRepeatOrder(order.items);
                      onClose();
                    }}
                    className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm border border-neutral-700/60"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Repetir compra</span>
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
