import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CategoriesApi, ProductsApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { Category, Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, Select, Textarea, currency } from '../components/ui';
import { downloadCsv } from '../utils/csv';

const emptyForm = {
  sku: '',
  name: '',
  description: '',
  material: '',
  dimensions: '',
  color: '',
  costPrice: '',
  sellingPrice: '',
  stockQuantity: '',
  reorderLevel: '5',
  imageUrl: '',
  categoryId: '',
};

export default function Products() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const lowStockOnly = searchParams.get('lowStock') === 'true';

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const load = () => {
    setLoading(true);
    ProductsApi.list({ search: search || undefined, lowStock: lowStockOnly || undefined })
      .then((res) => setProducts(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    CategoriesApi.list().then((res) => setCategories(res.data));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, lowStockOnly]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description ?? '',
      material: p.material ?? '',
      dimensions: p.dimensions ?? '',
      color: p.color ?? '',
      costPrice: String(p.costPrice),
      sellingPrice: String(p.sellingPrice),
      stockQuantity: String(p.stockQuantity),
      reorderLevel: String(p.reorderLevel),
      imageUrl: p.imageUrl ?? '',
      categoryId: p.categoryId ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      material: form.material || undefined,
      dimensions: form.dimensions || undefined,
      color: form.color || undefined,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      stockQuantity: Number(form.stockQuantity || 0),
      reorderLevel: Number(form.reorderLevel || 5),
      imageUrl: form.imageUrl || undefined,
      categoryId: form.categoryId || null,
    };
    try {
      if (editing) {
        await ProductsApi.update(editing.id, payload);
        toast.success('Product updated');
      } else {
        await ProductsApi.create(payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Remove "${p.name}" from the catalog?`)) return;
    try {
      await ProductsApi.remove(p.id);
      toast.success('Product removed');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `products-${new Date().toISOString().slice(0, 10)}.csv`,
      ['SKU', 'Name', 'Category', 'Cost price', 'Selling price', 'Stock', 'Reorder level'],
      products.map((p) => [p.sku, p.name, p.category?.name ?? '', p.costPrice.toFixed(2), p.sellingPrice.toFixed(2), p.stockQuantity, p.reorderLevel])
    );
  };

  const handleAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    const qty = Number(adjustQty);
    if (!qty) {
      toast.error('Enter a non-zero quantity');
      return;
    }
    try {
      await ProductsApi.adjustStock(adjustTarget.id, qty, adjustNote || undefined);
      toast.success('Stock adjusted');
      setAdjustTarget(null);
      setAdjustQty('');
      setAdjustNote('');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your furniture catalog and stock levels"
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={products.length === 0}>
              Export CSV
            </Button>
            {canEdit && <Button onClick={openCreate}>+ New product</Button>}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              if (e.target.checked) next.set('lowStock', 'true');
              else next.delete('lowStock');
              setSearchParams(next);
            }}
          />
          Low stock only
        </label>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-400">Loading…</div>
        ) : products.length === 0 ? (
          <EmptyState message="No products found." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800">{p.name}</div>
                    <div className="text-xs text-stone-400">{p.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{p.category?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-stone-800">{currency(p.sellingPrice)}</div>
                    <div className="text-xs text-stone-400">cost {currency(p.costPrice)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={p.stockQuantity <= p.reorderLevel ? 'red' : 'green'}>
                      {p.stockQuantity} in stock
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {canEdit && (
                      <>
                        <button className="text-stone-600 hover:underline text-xs" onClick={() => setAdjustTarget(p)}>
                          Adjust stock
                        </button>
                        <button className="text-brand-600 hover:underline text-xs" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button className="text-red-600 hover:underline text-xs" onClick={() => handleDelete(p)}>
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit product' : 'New product'} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Material</Label>
            <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
          </div>
          <div>
            <Label>Dimensions</Label>
            <Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="72in x 36in x 30in" />
          </div>
          <div>
            <Label>Color</Label>
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div>
            <Label>Cost price</Label>
            <Input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} required />
          </div>
          <div>
            <Label>Selling price</Label>
            <Input type="number" step="0.01" min="0" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
          </div>
          <div>
            <Label>{editing ? 'Stock quantity (read-only — use Adjust stock)' : 'Initial stock quantity'}</Label>
            <Input
              type="number"
              min="0"
              value={form.stockQuantity}
              onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
              disabled={!!editing}
            />
          </div>
          <div>
            <Label>Reorder level</Label>
            <Input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Image URL</Label>
            <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title={`Adjust stock — ${adjustTarget?.name ?? ''}`}>
        <form onSubmit={handleAdjust} className="space-y-4">
          <p className="text-sm text-stone-500">Current stock: {adjustTarget?.stockQuantity}</p>
          <div>
            <Label>Change quantity (use negative to remove)</Label>
            <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} required />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. damaged in transit, stock count correction" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
