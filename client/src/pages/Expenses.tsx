import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ExpensesApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { Expense, ExpenseCategory } from '../types';
import { Button, Card, EmptyState, Input, Label, Modal, PageHeader, Select, currency } from '../components/ui';
import { format, parseISO } from 'date-fns';

const CATEGORIES: ExpenseCategory[] = ['RENT', 'UTILITIES', 'WAGES', 'MARKETING', 'SUPPLIES', 'SHIPPING', 'OTHER'];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: 'OTHER' as ExpenseCategory, description: '', amount: '', expenseDate: '' });

  const load = () => {
    setLoading(true);
    ExpensesApi.list({ category: categoryFilter || undefined })
      .then((res) => setExpenses(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [categoryFilter]);

  const openCreate = () => {
    setForm({ category: 'OTHER', description: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await ExpensesApi.create({
        category: form.category,
        description: form.description || undefined,
        amount,
        expenseDate: form.expenseDate ? new Date(form.expenseDate).toISOString() : undefined,
      });
      toast.success('Expense recorded');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: Expense) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await ExpensesApi.remove(e.id);
      toast.success('Expense deleted');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Operating costs used to calculate net profit" actions={<Button onClick={openCreate}>+ New expense</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="max-w-xs">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <span className="text-sm text-stone-500">
          Total: <span className="font-semibold text-stone-800">{currency(total)}</span>
        </span>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-400">Loading…</div>
        ) : expenses.length === 0 ? (
          <EmptyState message="No expenses recorded yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Recorded by</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 text-stone-500">{format(parseISO(e.expenseDate), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 text-stone-800 font-medium">{e.category}</td>
                  <td className="px-4 py-3 text-stone-500">{e.description || '—'}</td>
                  <td className="px-4 py-3 text-stone-500">{e.user?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-stone-800">{currency(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-red-600 hover:underline text-xs" onClick={() => handleDelete(e)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Category</Label>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
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
