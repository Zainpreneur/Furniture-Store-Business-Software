import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomersApi, ProductsApi, SalesOrdersApi } from '../api/resources';
import type { Customer, Product, SalesOrder } from '../types';
import { currency } from './ui';

interface Results {
  products: Product[];
  customers: Customer[];
  orders: SalesOrder[];
}

const EMPTY: Results = { products: [], customers: [], orders: [] };

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      Promise.all([
        ProductsApi.list({ search: q }),
        CustomersApi.list({ search: q }),
        SalesOrdersApi.list({ search: q }),
      ])
        .then(([products, customers, orders]) => {
          setResults({ products: products.data.slice(0, 5), customers: customers.data.slice(0, 5), orders: orders.data.slice(0, 5) });
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const goTo = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const hasResults = results.products.length + results.customers.length + results.orders.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="Search products, customers, orders…"
        className="w-full px-3 py-2 rounded-lg bg-stone-800 text-stone-100 placeholder-stone-400 text-sm border border-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {open && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg border border-stone-200 shadow-lg z-50 max-h-96 overflow-y-auto text-sm">
          {loading && <div className="px-4 py-3 text-stone-400">Searching…</div>}
          {!loading && !hasResults && <div className="px-4 py-3 text-stone-400">No matches for "{query}".</div>}

          {results.products.length > 0 && (
            <div className="py-1">
              <div className="px-4 py-1 text-xs uppercase text-stone-400">Products</div>
              {results.products.map((p) => (
                <button key={p.id} className="w-full text-left px-4 py-2 hover:bg-stone-50 flex justify-between" onClick={() => goTo('/products')}>
                  <span>
                    {p.name} <span className="text-stone-400">({p.sku})</span>
                  </span>
                  <span className="text-stone-500">{currency(p.sellingPrice)}</span>
                </button>
              ))}
            </div>
          )}

          {results.customers.length > 0 && (
            <div className="py-1 border-t border-stone-100">
              <div className="px-4 py-1 text-xs uppercase text-stone-400">Customers</div>
              {results.customers.map((c) => (
                <button key={c.id} className="w-full text-left px-4 py-2 hover:bg-stone-50" onClick={() => goTo('/customers')}>
                  {c.name} {c.email && <span className="text-stone-400">— {c.email}</span>}
                </button>
              ))}
            </div>
          )}

          {results.orders.length > 0 && (
            <div className="py-1 border-t border-stone-100">
              <div className="px-4 py-1 text-xs uppercase text-stone-400">Sales orders</div>
              {results.orders.map((o) => (
                <button
                  key={o.id}
                  className="w-full text-left px-4 py-2 hover:bg-stone-50 flex justify-between"
                  onClick={() => goTo(`/sales-orders/${o.id}`)}
                >
                  <span>
                    {o.orderNumber} <span className="text-stone-400">— {o.customer?.name ?? 'Walk-in'}</span>
                  </span>
                  <span className="text-stone-500">{currency(o.total)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
