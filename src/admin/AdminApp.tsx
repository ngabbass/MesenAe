import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { requestForToken } from "@/lib/fcm";
import { toast } from "sonner";
import AppLayout from "@/admin/components/layout/AppLayout";
import { usePermissions, UserPermissions } from "@/hooks/use-permissions";
import {
  DashboardSkeleton,
  ProductsSkeleton,
  ReportsSkeleton,
  TransactionHistorySkeleton,
  VouchersSkeleton,
  SettingsSkeleton,
  PageSkeleton,
  CashierSkeleton,
  QrisDinamisSkeleton,
} from "@/admin/components/SkeletonLoaders";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cashier = lazy(() => import("./pages/Cashier"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const Categories = lazy(() => import("./components/Categories"));
const Settings = lazy(() => import("./pages/Settings"));
const SupplierPage = lazy(() => import("./pages/Supplier"));
const Inventory = lazy(() => import("./pages/Inventory"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const StockReport = lazy(() => import("./pages/StockReport"));
const ActiveOrders = lazy(() => import("./pages/ActiveOrders"));
const Kitchen = lazy(() => import("./pages/Kitchen"));
const QrCodeMenu = lazy(() => import("./pages/QrCodeMenu"));
const QrisDinamisMenu = lazy(() => import("./pages/QrisDinamisMenu"));
const Vouchers = lazy(() => import("./pages/Vouchers"));
const BannerPromo = lazy(() => import("./pages/BannerPromo"));
const BannerEditor = lazy(() => import("./pages/BannerEditor"));
const BarcodePrint = lazy(() => import("./pages/BarcodePrint"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Customers = lazy(() => import("./pages/Customers"));

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const authString = localStorage.getItem('admin_auth');
  if (!authString) {
    return <Navigate to="/login" replace />;
  }
  
  try {
    const auth = JSON.parse(authString);
    if (!auth || !auth.role) return <Navigate to="/login" replace />;
    
    // Check if session has expired
    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      localStorage.removeItem('admin_auth');
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
    localStorage.removeItem('admin_auth');
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const ProtectedInventoryRoute = ({ children }: { children: React.ReactNode }) => {
  const { canView } = usePermissions();
  const authString = localStorage.getItem('admin_auth');
  if (!authString) return <Navigate to="/login" replace />;
  
  if (canView('stockIn') || canView('stockOut') || canView('tools')) {
    return <>{children}</>;
  }
  
  return <Navigate to="/admin" replace />;
};

const ProtectedModuleRoute = ({ children, moduleName }: { children: React.ReactNode, moduleName: keyof UserPermissions }) => {
  const { canView } = usePermissions();
  const authString = localStorage.getItem('admin_auth');
  if (!authString) return <Navigate to="/login" replace />;
  
  if (canView(moduleName)) {
    return <>{children}</>;
  }
  
  const moduleOrder: (keyof UserPermissions)[] = [
    'dashboard',
    'cashier',
    'activeOrders',
    'kitchen',
    'history',
    'products',
    'categories',
    'suppliers',
    'stockIn',
    'stockOut',
    'reports',
    'marketing',
    'tools',
    'settings'
  ];
  
  const routeMap: Record<keyof UserPermissions, string> = {
    dashboard: '/admin',
    cashier: '/admin/cashier',
    activeOrders: '/admin/orders',
    kitchen: '/admin/kitchen',
    history: '/admin/history',
    products: '/admin/products',
    categories: '/admin/products',
    suppliers: '/admin/supplier',
    stockIn: '/admin/inventory?tab=stock-in',
    stockOut: '/admin/inventory?tab=stock-out',
    reports: '/admin/reports',
    marketing: '/admin/qr-code',
    tools: '/admin/barcode',
    settings: '/admin/settings'
  };

  const allowedModule = moduleOrder.find(m => canView(m));
  if (allowedModule) {
    return <Navigate to={routeMap[allowedModule]} replace />;
  }
  
  return <Navigate to="/login" replace />;
};

export default function AdminApp() {
  const authData = JSON.parse(localStorage.getItem('admin_auth') || '{}');
  const role = authData.role || 'admin';
  const name = authData.name || 'Admin';

  // Request notification permission on mount
  useEffect(() => {
    if (role && name) {
      requestForToken('admin', name).then(() => {
        // Token registered silently
      });
    }
  }, [role, name]);

  return (
    <Routes>
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="" element={
          <ProtectedModuleRoute moduleName="dashboard">
            <Suspense fallback={<DashboardSkeleton />}>
              <Dashboard />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="cashier" element={
          <ProtectedModuleRoute moduleName="cashier">
            <Suspense fallback={<CashierSkeleton />}>
              <Cashier />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="orders" element={
          <ProtectedModuleRoute moduleName="activeOrders">
            <Suspense fallback={<PageSkeleton />}>
              <ActiveOrders />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="kitchen" element={
          <ProtectedModuleRoute moduleName="kitchen">
            <Suspense fallback={<PageSkeleton />}>
              <Kitchen />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="products" element={
          <ProtectedModuleRoute moduleName="products">
            <Suspense fallback={<ProductsSkeleton />}>
              <Products />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="categories" element={<Navigate to="/admin/products" replace />} />
        <Route path="reports" element={
          <ProtectedModuleRoute moduleName="reports">
            <Suspense fallback={<ReportsSkeleton />}>
              <Reports />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="settings" element={
          <ProtectedModuleRoute moduleName="settings">
            <Suspense fallback={<SettingsSkeleton />}>
              <Settings />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="supplier" element={<Navigate to="/admin/inventory?tab=supplier" replace />} />
        <Route path="stock-in" element={<Navigate to="/admin/inventory?tab=stock-in" replace />} />
        <Route path="stock-out" element={<Navigate to="/admin/inventory?tab=stock-out" replace />} />
        <Route path="barcode" element={
          <ProtectedModuleRoute moduleName="tools">
            <Suspense fallback={<PageSkeleton />}>
              <BarcodePrint />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="inventory" element={
          <ProtectedInventoryRoute>
            <Suspense fallback={<PageSkeleton />}>
              <Inventory />
            </Suspense>
          </ProtectedInventoryRoute>
        } />
        <Route path="history" element={
          <ProtectedModuleRoute moduleName="history">
            <Suspense fallback={<TransactionHistorySkeleton />}>
              <TransactionHistory />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="stock-report" element={<Navigate to="/admin/reports?tab=stock" replace />} />
        <Route path="qr-code" element={
          <ProtectedModuleRoute moduleName="marketing">
            <Suspense fallback={<PageSkeleton />}>
              <QrCodeMenu />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="qris-dinamis" element={
          <ProtectedModuleRoute moduleName="dashboard">
            <Suspense fallback={<QrisDinamisSkeleton />}>
              <QrisDinamisMenu />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="vouchers" element={
          <ProtectedModuleRoute moduleName="marketing">
            <Suspense fallback={<VouchersSkeleton />}>
              <Vouchers />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="banner" element={
          <ProtectedModuleRoute moduleName="marketing">
            <Suspense fallback={<PageSkeleton />}>
              <BannerPromo />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="banner/edit/:id" element={
          <ProtectedModuleRoute moduleName="marketing">
            <Suspense fallback={<PageSkeleton />}>
              <BannerEditor />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="expenses" element={
          <ProtectedModuleRoute moduleName="expenses">
            <Suspense fallback={<PageSkeleton />}>
              <Expenses />
            </Suspense>
          </ProtectedModuleRoute>
        } />
        <Route path="customers" element={
          <ProtectedModuleRoute moduleName="customers">
            <Suspense fallback={<PageSkeleton />}>
              <Customers />
            </Suspense>
          </ProtectedModuleRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
