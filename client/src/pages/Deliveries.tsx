import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SalesOrdersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { DeliveryStatus, SalesOrder } from '../types';
import { Badge, Card, EmptyState, PageHeader, Select, currency } from '../components/ui';
import { format, parseISO } from 'date-fns';

const DELIVERY_STATUSES: DeliveryStatus[] = ['NOT_SCHEDULED', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function Deliveries() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    SalesOrdersApi.list({ fulfillmentMethod: 'DELIVERY', deliveryStatus: statusFilter || undefined })
      .then((res) => setOrders(res.data.filter((o) => o.status !== 'CANCELLED')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const handleStatusChange = async (order: SalesOrder, deliveryStatus: DeliveryStatus) => {
    try {
      await SalesOrdersApi.updateDelivery(order.id, { deliveryStatus });
      toast.success('Delivery status updated');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title="Deliveries" subtitle="Orders scheduled for home delivery" />

      <div className="mb-4">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-xs">
          <option value="">All delivery statuses</option>
          {DELIVERY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-400">Loading…</div>
        ) : orders.length === 0 ? (
          <EmptyState message="No deliveries to show." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Delivery status</th>
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
                  <td className="px-4 py-3 text-stone-500 max-w-xs truncate">{o.deliveryAddress || '—'}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {o.scheduledDate ? format(parseISO(o.scheduledDate), 'MMM d, yyyy') : <Badge tone="yellow">Not scheduled</Badge>}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">{currency(o.total)}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={o.deliveryStatus}
                      onChange={(e) => handleStatusChange(o, e.target.value as DeliveryStatus)}
                      className="w-auto text-xs py-1"
                    >
                      {DELIVERY_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
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
