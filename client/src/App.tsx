import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import SalesOrders from './pages/SalesOrders';
import SalesOrderCreate from './pages/SalesOrderCreate';
import SalesOrderDetail from './pages/SalesOrderDetail';
import Users from './pages/Users';
import Expenses from './pages/Expenses';
import Deliveries from './pages/Deliveries';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/sales-orders" element={<SalesOrders />} />
              <Route path="/sales-orders/new" element={<SalesOrderCreate />} />
              <Route path="/sales-orders/:id" element={<SalesOrderDetail />} />
              <Route path="/deliveries" element={<Deliveries />} />

              <Route element={<ProtectedRoute roles={['ADMIN', 'MANAGER']} />}>
                <Route path="/expenses" element={<Expenses />} />
              </Route>

              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="/users" element={<Users />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<div className="p-8 text-stone-400">Page not found.</div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
