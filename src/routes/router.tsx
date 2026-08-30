import { Navigate, createMemoryRouter } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { AllTransactions } from "@/routes/AllTransactions";
import { BusinessOnly } from "@/routes/BusinessOnly";
import { Home } from "@/routes/Home";
import { Invoices } from "@/routes/Invoices";
import { NewInvoice } from "@/routes/NewInvoice";
import { Onboarding } from "@/routes/Onboarding";
import { Reports } from "@/routes/Reports";
import { Settings } from "@/routes/Settings";
import { TransactionForm } from "@/routes/TransactionForm";

/**
 * Memory router: real routes and params (`/invoices/:id/edit`) with no URL bar, which is
 * what a Tauri webview wants. Nothing here depends on the address being visible.
 */
export const router = createMemoryRouter([
  { path: "/onboarding", element: <Onboarding /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: "transactions", element: <AllTransactions /> },
      { path: "transactions/new", element: <TransactionForm /> },
      { path: "transactions/:id", element: <TransactionForm /> },
      {
        path: "invoices",
        element: (
          <BusinessOnly>
            <Invoices />
          </BusinessOnly>
        ),
      },
      {
        path: "invoices/new",
        element: (
          <BusinessOnly>
            <NewInvoice />
          </BusinessOnly>
        ),
      },
      {
        path: "invoices/:id/edit",
        element: (
          <BusinessOnly>
            <NewInvoice />
          </BusinessOnly>
        ),
      },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
