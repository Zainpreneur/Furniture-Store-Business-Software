import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DashboardApi } from '../api/resources';
import type { DashboardSummary } from '../types';
import { Badge, Card, EmptyState, PageHeader, StatCard, currency, statusTone } from '../components/ui';
import { format, parseISO } from 'date-fns';

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DashboardApi.summary()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-stone-400 text-sm">Loading dashboard…</div>;
  if (!data) return <EmptyState message="Could not load dashboard data." />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your furniture store's performance" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Revenue today" value={currency(data.revenue.today)} tone="green" />
        <StatCard label="Revenue this month" value={currency(data.revenue.month)} tone="green" />
        <StatCard label="Products" value={String(data.counts.productCount)} />
        <StatCard label="Customers" value={String(data.counts.customerCount)} />
        <StatCard label="Open purchase orders" value={String(data.counts.pendingPurchaseOrders)} />
        <StatCard label="Low stock items" value={String(data.counts.lowStockCount)} tone={data.counts.lowStockCount > 0 ? 'red' : 'stone'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-4 lg:col-span-2">
          <h2 className="font-semibold text-stone-800 mb-4">Revenue — last 30 days</h2>
          {data.revenueSeries.length === 0 ? (
            <EmptyState message="No sales recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), 'MMM d')} fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => currency(v)} labelFormatter={(d) => format(parseISO(d as string), 'MMM d, yyyy')} />
                <Line type="monotone" dataKey="total" stroke="#a8763f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-stone-800 mb-4">Top products (30 days)</h2>
          {data.topProducts.length === 0 ? (
            <EmptyState message="No sales yet." />
          ) : (
            <ul className="space-y-3">
              {data.topProducts.map((t, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-stone-800 truncate">{t.product?.name ?? 'Unknown product'}</div>
                    <div className="text-xs text-stone-400">{t.unitsSold} sold</div>
                  </div>
                  <div className="font-medium text-stone-700 shrink-0 ml-2">{currency(t.revenue)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-800">Low stock alerts</h2>
            <Link to="/products?lowStock=true" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <EmptyState message="All products are well stocked." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.lowStockProducts.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-stone-800">{p.name}</div>
                    <div className="text-xs text-stone-400">{p.sku}</div>
                  </div>
                  <Badge tone="red">
                    {p.stockQuantity} / {p.reorderLevel}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-800">Recent orders</h2>
            <Link to="/sales-orders" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <EmptyState message="No orders yet." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-stone-800">{o.orderNumber}</div>
                    <div className="text-xs text-stone-400">{o.customer?.name ?? 'Walk-in customer'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-700 font-medium">{currency(o.total)}</span>
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
