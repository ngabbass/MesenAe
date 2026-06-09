import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KitchenLayout from './components/KitchenLayout';
import KitchenDisplay from './pages/KitchenDisplay';

export { default as KitchenReceiptModal } from './components/KitchenReceiptModal';

const KitchenProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const authString = localStorage.getItem('kitchen_auth');
  if (!authString) return <Navigate to="/login" replace />;

  try {
    const auth = JSON.parse(authString);
    if (!auth || !['admin', 'user', 'dapur'].includes(auth.role))
      return <Navigate to="/login" replace />;
    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      localStorage.removeItem('kitchen_auth');
      localStorage.removeItem('admin_auth');
      return <Navigate to="/login" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function KitchenApp() {
  return (
    <Routes>
      <Route
        element={
          <KitchenProtectedRoute>
            <KitchenLayout />
          </KitchenProtectedRoute>
        }
      >
        <Route path="" element={<KitchenDisplay />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
