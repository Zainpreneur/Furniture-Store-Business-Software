import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { SuppliersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { Supplier } from '../types';
import { useAuth } from '../context/AuthContext';
import { Button, Card, EmptyState, Input, Label, Modal, PageHeader, Textarea } from '../components/ui';

const emptyForm = { name: '', contactName: '', email: '', phone: '', address: '' };

export default function Suppliers() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    SuppliersApi.list({ search: search || undefined })
      .then((res) => setSuppliers(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contactName: s.contactName ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await SuppliersApi.update(editing.id, form);
        toast.success('Supplier updated');
      } else {
        await SuppliersApi.create(form);
        toast.success('Supplier added');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try {
      await SuppliersApi.remove(s.id);
      toast.success('Supplier deleted');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Vendors you purchase furniture and materials from"
        actions={canEdit ? <Button onClick={openCreate}>+ New supplier</Button> : undefined}
      />

      <Input placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs mb-4" />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-400">Loading…</div>
        ) : suppliers.length === 0 ? (
          <EmptyState message="No suppliers yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Purchase orders</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-800">{s.name}</td>
                  <td className="px-4 py-3 text-stone-500">
                    <div>{s.contactName || '—'}</div>
                    <div className="text-xs text-stone-400">{s.email || s.phone || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{s.address || '—'}</td>
                  <td className="px-4 py-3 text-stone-500">{s._count?.purchaseOrders ?? 0}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button className="text-brand-600 hover:underline text-xs" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                      <button className="text-red-600 hover:underline text-xs" onClick={() => handleDelete(s)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit supplier' : 'New supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Company name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Contact name</Label>
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
