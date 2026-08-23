import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SalesOrdersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { SalesOrder, SalesOrderStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, PageHeader, Select, currency, statusTone } from '../components/ui';
import { format, parseISO } from 'date-fns';

const ALL_STATUSES: SalesOrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    setLoading(true);
    SalesOrdersApi.get(id)
      .then((res) => setOrder(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleStatusChange = async (status: SalesOrderStatus) => {
    if (!order) return;
    if (status === 'CANCELLED' && !confirm('Cancel this order? Stock will be returned to inventory.')) return;
    try {
      await SalesOrdersApi.setStatus(order.id, status);
      toast.success('Order updated');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (loading) return <div className="text-stone-400 text-sm">Loading…</div>;
  if (!order) return <div className="text-stone-400 text-sm">Order not found.</div>;

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title={`Invoice ${order.orderNumber}`}
          subtitle={format(parseISO(order.orderDate), "MMMM d, yyyy 'at' h:mm a")}
          actions={
            <>
              <Link to="/sales-orders">
                <Button variant="secondary">Back</Button>
              </Link>
              <Button variant="secondary" onClick={() => window.print()}>
                Print invoice
              </Button>
            </>
          }
        />

        {canManage && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-stone-500">Update status:</span>
            <Select
              value=""
              onChange={(e) => e.target.value && handleStatusChange(e.target.value as SalesOrderStatus)}
              className="w-auto"
            >
              <option value="">Choose…</option>
              {ALL_STATUSES.filter((s) => s !== order.status).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <Card className="p-8 print:shadow-none print:border-0">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="text-xl font-semibold text-stone-900">🛋️ Woodhaven Furniture Co.</div>
            <div className="text-sm text-stone-500 mt-1">Invoice / Sales Receipt</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-stone-900">{order.orderNumber}</div>
            <Badge tone={statusTone(order.status)}>{order.status}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
          <div>
            <div className="text-xs uppercase text-stone-400 mb-1">Bill to</div>
            <div className="font-medium text-stone-800">{order.customer?.name ?? 'Walk-in customer'}</div>
            {order.customer?.email && <div className="text-stone-500">{order.customer.email}</div>}
            {order.customer?.phone && <div className="text-stone-500">{order.customer.phone}</div>}
            {order.customer?.address && <div className="text-stone-500">{order.customer.address}</div>}
          </div>
          <div>
            <div className="text-xs uppercase text-stone-400 mb-1">Order details</div>
            <div className="text-stone-500">Date: {format(parseISO(order.orderDate), 'MMM d, yyyy')}</div>
            <div className="text-stone-500">Payment: {order.paymentMethod.replace('_', ' ')}</div>
            <div className="text-stone-500">Sold by: {order.user?.name ?? '—'}</div>
          </div>
        </div>

        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="text-left text-xs text-stone-400 uppercase border-b border-stone-200">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b border-stone-100">
                <td className="py-2">
                  <div className="font-medium text-stone-800">{it.product.name}</div>
                  <div className="text-xs text-stone-400">{it.product.sku}</div>
                </td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right">{currency(it.unitPrice)}</td>
                <td className="py-2 text-right font-medium">{currency(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>{currency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Tax ({(order.taxRate * 100).toFixed(1)}%)</span>
              <span>{currency(order.tax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-900 text-base pt-2 border-t border-stone-200">
              <span>Total</span>
              <span>{currency(order.total)}</span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="mt-8 text-sm text-stone-500">
            <div className="text-xs uppercase text-stone-400 mb-1">Notes</div>
            {order.notes}
          </div>
        )}
      </Card>
    </div>
  );
}
