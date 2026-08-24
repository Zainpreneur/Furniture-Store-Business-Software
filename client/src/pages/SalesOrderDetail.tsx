import { FormEvent, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SalesOrdersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { DeliveryStatus, PaymentMethod, SalesOrder, SalesOrderStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, Input, Label, Modal, PageHeader, Select, currency, statusTone } from '../components/ui';
import { format, parseISO } from 'date-fns';

const ALL_STATUSES: SalesOrderStatus[] = ['PENDING', 'PARTIALLY_PAID', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'FINANCING', 'OTHER'];
const DELIVERY_STATUSES: DeliveryStatus[] = ['NOT_SCHEDULED', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentNote, setPaymentNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [savingDelivery, setSavingDelivery] = useState(false);

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

  const openPaymentModal = () => {
    setPaymentAmount(order ? order.balanceDue.toFixed(2) : '');
    setPaymentMethod('CASH');
    setPaymentNote('');
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    setSavingPayment(true);
    try {
      await SalesOrdersApi.recordPayment(order.id, { amount, method: paymentMethod, note: paymentNote || undefined });
      toast.success('Payment recorded');
      setPaymentModalOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingPayment(false);
    }
  };

  const openDeliveryModal = () => {
    setDeliveryAddress(order?.deliveryAddress ?? '');
    setScheduledDate(order?.scheduledDate ? order.scheduledDate.slice(0, 10) : '');
    setDeliveryModalOpen(true);
  };

  const handleSaveDelivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSavingDelivery(true);
    try {
      await SalesOrdersApi.updateDelivery(order.id, {
        deliveryAddress,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      });
      toast.success('Delivery details updated');
      setDeliveryModalOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleDeliveryStatusChange = async (deliveryStatus: DeliveryStatus) => {
    if (!order) return;
    try {
      await SalesOrdersApi.updateDelivery(order.id, { deliveryStatus });
      toast.success('Delivery status updated');
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

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          {canManage && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <div className="flex items-center gap-2">
              <span className="text-stone-500">Status:</span>
              <Select value="" onChange={(e) => e.target.value && handleStatusChange(e.target.value as SalesOrderStatus)} className="w-auto">
                <option value="">Choose…</option>
                {ALL_STATUSES.filter((s) => s !== order.status).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {order.status !== 'CANCELLED' && order.balanceDue > 0 && (
            <Button onClick={openPaymentModal}>Record payment ({currency(order.balanceDue)} due)</Button>
          )}

          {order.fulfillmentMethod === 'DELIVERY' && order.status !== 'CANCELLED' && (
            <div className="flex items-center gap-2">
              <span className="text-stone-500">Delivery:</span>
              <Select value={order.deliveryStatus} onChange={(e) => handleDeliveryStatusChange(e.target.value as DeliveryStatus)} className="w-auto">
                {DELIVERY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
              <button className="text-brand-600 hover:underline text-xs" onClick={openDeliveryModal}>
                Edit address/date
              </button>
            </div>
          )}
        </div>
      </div>

      <Card className="p-8 print:shadow-none print:border-0">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="text-xl font-semibold text-stone-900">🛋️ Woodhaven Furniture Co.</div>
            <div className="text-sm text-stone-500 mt-1">Invoice / Sales Receipt</div>
          </div>
          <div className="text-right space-y-1">
            <div className="font-semibold text-stone-900">{order.orderNumber}</div>
            <Badge tone={statusTone(order.status)}>{order.status.replace(/_/g, ' ')}</Badge>
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
            <div className="text-stone-500">
              Fulfillment: {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'In-store pickup'}
              {order.fulfillmentMethod === 'DELIVERY' && ` — ${order.deliveryStatus.replace(/_/g, ' ').toLowerCase()}`}
            </div>
            {order.fulfillmentMethod === 'DELIVERY' && order.deliveryAddress && (
              <div className="text-stone-500">Deliver to: {order.deliveryAddress}</div>
            )}
            {order.fulfillmentMethod === 'DELIVERY' && order.scheduledDate && (
              <div className="text-stone-500">Scheduled: {format(parseISO(order.scheduledDate), 'MMM d, yyyy')}</div>
            )}
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
          <div className="w-72 text-sm space-y-1">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>{currency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Discount</span>
                <span>-{currency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600">
              <span>Tax ({(order.taxRate * 100).toFixed(1)}%)</span>
              <span>{currency(order.tax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-900 text-base pt-2 border-t border-stone-200">
              <span>Total</span>
              <span>{currency(order.total)}</span>
            </div>
            <div className="flex justify-between text-stone-600 pt-1">
              <span>Amount paid</span>
              <span>{currency(order.amountPaid)}</span>
            </div>
            <div className={`flex justify-between font-semibold ${order.balanceDue > 0 ? 'text-red-600' : 'text-green-700'}`}>
              <span>Balance due</span>
              <span>{currency(order.balanceDue)}</span>
            </div>
          </div>
        </div>

        {order.payments.length > 0 && (
          <div className="mt-8">
            <div className="text-xs uppercase text-stone-400 mb-2">Payment history</div>
            <table className="w-full text-sm">
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100">
                    <td className="py-2 text-stone-500">{format(parseISO(p.createdAt), 'MMM d, yyyy h:mm a')}</td>
                    <td className="py-2 text-stone-500">{p.method.replace('_', ' ')}</td>
                    <td className="py-2 text-stone-500">{p.note || '—'}</td>
                    <td className="py-2 text-right font-medium text-stone-800">{currency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {order.notes && (
          <div className="mt-8 text-sm text-stone-500">
            <div className="text-xs uppercase text-stone-400 mb-1">Notes</div>
            {order.notes}
          </div>
        )}
      </Card>

      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Record payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <p className="text-sm text-stone-500">Balance due: {currency(order.balanceDue)}</p>
          <div>
            <Label>Amount</Label>
            <Input type="number" min="0.01" step="0.01" max={order.balanceDue} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Method</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. layaway installment 2 of 3" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingPayment}>
              {savingPayment ? 'Saving…' : 'Record payment'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deliveryModalOpen} onClose={() => setDeliveryModalOpen(false)} title="Edit delivery details">
        <form onSubmit={handleSaveDelivery} className="space-y-4">
          <div>
            <Label>Delivery address</Label>
            <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>
          <div>
            <Label>Scheduled date</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeliveryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingDelivery}>
              {savingDelivery ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
