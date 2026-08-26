import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SalesOrdersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { SalesOrder, SalesOrderStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, currency, statusTone } from '../components/ui';
import { downloadCsv } from '../utils/csv';
import { format, parseISO } from 'date-fns';

const ALL_STATUSES: SalesOrderStatus[] = ['PENDING', 'PARTIALLY_PAID', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

export default function SalesOrders() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    SalesOrdersApi.list({ status: status || undefined, search: search || undefined })
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

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

  const exportCsv = () => {
    downloadCsv(
      `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order #', 'Customer', 'Sold by', 'Subtotal', 'Discount', 'Tax', 'Total', 'Amount paid', 'Balance due', 'Status', 'Fulfillment', 'Date'],
      orders.map((o) => [
        o.orderNumber,
        o.customer?.name ?? 'Walk-in',
        o.user?.name ?? '',
        o.subtotal.toFixed(2),
        o.discount.toFixed(2),
        o.tax.toFixed(2),
        o.total.toFixed(2),
        o.amountPaid.toFixed(2),
        o.balanceDue.toFixed(2),
        o.status,
        o.fulfillmentMethod,
        format(parseISO(o.orderDate), 'yyyy-MM-dd'),
      ])
    );
  };

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Point-of-sale orders and invoices"
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={orders.length === 0}>
              Export CSV
            </Button>
            <Link to="/sales-orders/new">
              <Button>+ New sale</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder="Search order # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-xs">
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
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
          <EmptyState message="No sales orders found." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Sold by</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Balance due</th>
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
                    {o.balanceDue > 0 ? (
                      <Badge tone="red">{currency(o.balanceDue)}</Badge>
                    ) : (
                      <span className="text-stone-400 text-xs">Paid in full</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, ' ')}</Badge>
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
                            {s.replace(/_/g, ' ')}
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
