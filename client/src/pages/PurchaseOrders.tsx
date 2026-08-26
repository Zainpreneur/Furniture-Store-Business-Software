import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProductsApi, PurchaseOrdersApi, SuppliersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { Product, PurchaseOrder, PurchaseOrderStatus, Supplier } from '../types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, Select, currency, statusTone } from '../components/ui';
import { format, parseISO } from 'date-fns';

interface DraftItem {
  productId: string;
  quantity: string;
  unitCost: string;
}

const nextStatuses: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  PENDING: ['ORDERED', 'CANCELLED'],
  ORDERED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

export default function PurchaseOrders() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ productId: '', quantity: '1', unitCost: '' }]);

  const load = () => {
    setLoading(true);
    PurchaseOrdersApi.list()
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    SuppliersApi.list().then((res) => setSuppliers(res.data));
    ProductsApi.list().then((res) => setProducts(res.data));
  }, []);

  const openCreate = () => {
    setSupplierId('');
    setExpectedDate('');
    setNotes('');
    setItems([{ productId: '', quantity: '1', unitCost: '' }]);
    setModalOpen(true);
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItemRow = () => setItems((prev) => [...prev, { productId: '', quantity: '1', unitCost: '' }]);
  const removeItemRow = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.productId && Number(it.quantity) > 0);
    if (!supplierId || validItems.length === 0) {
      toast.error('Select a supplier and at least one line item');
      return;
    }
    setSaving(true);
    try {
      await PurchaseOrdersApi.create({
        supplierId,
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : undefined,
        notes: notes || undefined,
        items: validItems.map((it) => ({ productId: it.productId, quantity: Number(it.quantity), unitCost: Number(it.unitCost || 0) })),
      });
      toast.success('Purchase order created');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (order: PurchaseOrder, status: PurchaseOrderStatus) => {
    const verb = status === 'RECEIVED' ? 'mark this order as received (this will increase stock)' : `change status to ${status}`;
    if (!confirm(`Are you sure you want to ${verb}?`)) return;
    try {
      await PurchaseOrdersApi.setStatus(order.id, status);
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const total = items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unitCost || 0), 0);

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Restock inventory from your suppliers"
        actions={canEdit ? <Button onClick={openCreate}>+ New purchase order</Button> : undefined}
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-400">Loading…</div>
        ) : orders.length === 0 ? (
          <EmptyState message="No purchase orders yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Order date</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const orderTotal = o.items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
                return (
                  <tr key={o.id} className="border-b border-stone-100 last:border-0 align-top">
                    <td className="px-4 py-3 font-medium text-stone-800">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-stone-500">{o.supplier.name}</td>
                    <td className="px-4 py-3 text-stone-500">
                      {o.items.map((it) => (
                        <div key={it.id}>
                          {it.quantity}× {it.product.name}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-stone-700 font-medium">{currency(orderTotal)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-stone-500">{format(parseISO(o.orderDate), 'MMM d, yyyy')}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {nextStatuses[o.status].map((s) => (
                          <button key={s} className="text-brand-600 hover:underline text-xs" onClick={() => handleStatusChange(o, s)}>
                            Mark {s.toLowerCase()}
                          </button>
                        ))}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New purchase order" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Supplier</Label>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Expected delivery date (optional)</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Line items</Label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select value={it.productId} onChange={(e) => updateItem(idx, { productId: e.target.value })} className="flex-1">
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                    className="w-20"
                    placeholder="Qty"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.unitCost}
                    onChange={(e) => updateItem(idx, { unitCost: e.target.value })}
                    className="w-28"
                    placeholder="Unit cost"
                  />
                  <button type="button" onClick={() => removeItemRow(idx)} className="text-red-500 text-lg px-1">
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItemRow} className="text-brand-600 text-xs hover:underline mt-2">
              + Add line item
            </button>
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            <div className="text-sm text-stone-600">
              Estimated total: <span className="font-semibold text-stone-900">{currency(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create purchase order'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
