import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/products', label: 'Products', icon: '🪑' },
  { to: '/categories', label: 'Categories', icon: '🗂️' },
  { to: '/sales-orders', label: 'Sales Orders', icon: '🧾' },
  { to: '/deliveries', label: 'Deliveries', icon: '🚛' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: '📦' },
  { to: '/suppliers', label: 'Suppliers', icon: '🚚' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const canSeeFinancials = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="min-h-screen flex bg-stone-50">
      <aside className="w-64 bg-stone-900 text-stone-100 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-stone-800">
          <div className="text-lg font-semibold flex items-center gap-2">
            <span>🛋️</span> Woodhaven
          </div>
          <div className="text-xs text-stone-400 mt-0.5">Furniture Store Business Software</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {canSeeFinancials && (
            <NavLink
              to="/expenses"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`
              }
            >
              <span>💵</span> Expenses
            </NavLink>
          )}
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`
              }
            >
              <span>🔐</span> Users
            </NavLink>
          )}
        </nav>
        <div className="px-5 py-4 border-t border-stone-800">
          <div className="text-sm font-medium">{user?.name}</div>
          <div className="text-xs text-stone-400">{user?.role}</div>
          <button onClick={logout} className="mt-2 text-xs text-stone-400 hover:text-white underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="bg-stone-900 px-6 py-3 flex justify-end print:hidden">
          <GlobalSearch />
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8 w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
