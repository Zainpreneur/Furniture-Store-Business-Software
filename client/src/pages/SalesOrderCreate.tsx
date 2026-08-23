import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CustomersApi, ProductsApi, SalesOrdersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { Customer, PaymentMethod, Product } from '../types';
import { Button, Card, Input, Label, PageHeader, Select, currency } from '../components/ui';

interface CartLine {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'FINANCING', 'OTHER'];

export default function SalesOrderCreate() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [taxRatePct, setTaxRatePct] = useState('8');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ProductsApi.list().then((res) => setProducts(res.data));
    CustomersApi.list().then((res) => setCustomers(res.data));
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          toast.error('Not enough stock available');
          return prev;
        }
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (product.stockQuantity < 1) {
        toast.error('Out of stock');
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: Math.max(0, Math.min(qty, l.product.stockQuantity)) } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (productId: string) => setCart((prev) => prev.filter((l) => l.product.id !== productId));

  const subtotal = cart.reduce((sum, l) => sum + l.product.sellingPrice * l.quantity, 0);
  const taxRate = Math.max(0, Number(taxRatePct || 0)) / 100;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one product to the cart');
      return;
    }
    setSubmitting(true);
    try {
      const res = await SalesOrdersApi.create({
        customerId: customerId || null,
        paymentMethod,
        taxRate,
        notes: notes || undefined,
        status: 'PAID',
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      });
      toast.success('Sale completed');
      navigate(`/sales-orders/${res.data.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="New Sale" subtitle="Ring up a sale and generate an invoice" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Input placeholder="Search products by name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stockQuantity < 1}
                className="text-left bg-white border border-stone-200 rounded-lg p-3 hover:border-brand-400 hover:shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="text-sm font-medium text-stone-800 line-clamp-2">{p.name}</div>
                <div className="text-xs text-stone-400 mt-1">{p.sku}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-brand-700">{currency(p.sellingPrice)}</span>
                  <span className="text-xs text-stone-400">{p.stockQuantity} left</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Card className="p-4 sticky top-6">
            <h2 className="font-semibold text-stone-800 mb-3">Cart</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-stone-400">No items yet — click a product to add it.</p>
            ) : (
              <ul className="space-y-3 mb-4">
                {cart.map((l) => (
                  <li key={l.product.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-800 truncate">{l.product.name}</div>
                      <div className="text-xs text-stone-400">{currency(l.product.sellingPrice)} each</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={l.product.stockQuantity}
                      value={l.quantity}
                      onChange={(e) => updateQty(l.product.id, Number(e.target.value))}
                      className="w-14 px-2 py-1 border border-stone-300 rounded text-sm"
                    />
                    <button onClick={() => removeLine(l.product.id)} className="text-red-500 text-lg px-1">
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-stone-200 pt-3 space-y-3">
              <div>
                <Label>Customer (optional)</Label>
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Payment method</Label>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replace('_', ' ')}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Tax rate (%)</Label>
                <Input type="number" min="0" step="0.1" value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="text-sm space-y-1 pt-2">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Tax</span>
                  <span>{currency(tax)}</span>
                </div>
                <div className="flex justify-between font-semibold text-stone-900 text-base pt-1 border-t border-stone-200">
                  <span>Total</span>
                  <span>{currency(total)}</span>
                </div>
              </div>

              <Button className="w-full justify-center" onClick={handleSubmit} disabled={submitting || cart.length === 0}>
                {submitting ? 'Processing…' : 'Complete sale'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
