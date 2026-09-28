import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { queryClient } from './query/query-client';
import { router } from './router';
import { authService } from './services/auth';

export function App() {
  const [, setAuthStatus] = useState(authService.getStatus());

  useEffect(() => {
    return authService.subscribe((status) => {
      setAuthStatus(status);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient, auth: authService }} />
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        stacked
      />
    </QueryClientProvider>
  );
}
