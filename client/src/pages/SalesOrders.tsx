import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SalesOrdersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { SalesOrder, SalesOrderStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, PageHeader, Select, currency, statusTone } from '../components/ui';
import { format, parseISO } from 'date-fns';

const ALL_STATUSES: SalesOrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

export default function SalesOrders() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    SalesOrdersApi.list({ status: status || undefined })
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  const handleStatusChange = async (order: SalesOrder, newStatus: SalesOrderStatus) => {
    if (newStatus === 'CANCELLED' && !confirm('Cancel this order? Stock will be returned to inventory.')) return;
    try {
      await SalesOrdersApi.setStatus(order.id, newStatus);
      toast.success('Order updated');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Point-of-sale orders and invoices"
        actions={<Link to="/sales-orders/new"><Button>+ New sale</Button></Link>}
      />

      <div className="mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-xs">
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-400">Loading…</div>
        ) : orders.length === 0 ? (
          <EmptyState message="No sales orders found." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Sold by</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-800">
                    <Link to={`/sales-orders/${o.id}`} className="hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{o.customer?.name ?? 'Walk-in'}</td>
                  <td className="px-4 py-3 text-stone-500">{o.user?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-stone-800">{currency(o.total)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{format(parseISO(o.orderDate), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                    <Link to={`/sales-orders/${o.id}`} className="text-brand-600 hover:underline text-xs">
                      View
                    </Link>
                    {canManage && o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                      <Select
                        value=""
                        onChange={(e) => e.target.value && handleStatusChange(o, e.target.value as SalesOrderStatus)}
                        className="inline-block w-auto text-xs py-1"
                      >
                        <option value="">Change status…</option>
                        {ALL_STATUSES.filter((s) => s !== o.status).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
