import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UsersApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import type { Role, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, Select } from '../components/ui';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'STAFF'];

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' as Role });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    UsersApi.list()
      .then((res) => setUsers(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', role: 'STAFF' });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await UsersApi.create(form);
      toast.success('User created');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await UsersApi.update(u.id, { isActive: !u.isActive });
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const changeRole = async (u: User, role: Role) => {
    try {
      await UsersApi.update(u.id, { role });
      toast.success('Role updated');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`Delete user "${u.name}"?`)) return;
    try {
      await UsersApi.remove(u.id);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage staff accounts and permissions" actions={<Button onClick={openCreate}>+ New user</Button>} />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-400">Loading…</div>
        ) : users.length === 0 ? (
          <EmptyState message="No users yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {u.name} {u.id === me?.id && <span className="text-xs text-stone-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-stone-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      disabled={u.id === me?.id}
                      className="w-auto text-xs py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button className="text-brand-600 hover:underline text-xs" onClick={() => toggleActive(u)} disabled={u.id === me?.id}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="text-red-600 hover:underline text-xs" onClick={() => handleDelete(u)} disabled={u.id === me?.id}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New user">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
