import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Login from "./Pages/Login.jsx";
import Register from "./Pages/Register.jsx";
import Dashboard from "./Pages/Dashboard.jsx";
import AdminDashboard from "./Pages/AdminDashboard.jsx";
import ForgotPassword from "./Pages/ForgotPassword.jsx";
import ResetPassword from "./Pages/ResetPassword.jsx";
import BloodDonors from "./Pages/BloodDonors.jsx";
import Chat from "./Pages/Chat.jsx";
import BloodBank from "./Pages/BloodBank.jsx";


import { AuthProvider } from "./context/AuthContext";   


const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/admin-dashboard", element: <AdminDashboard /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password/:token", element: <ResetPassword /> },
  { path: "/blood-donors", element: <BloodDonors /> },
  { path: "/blood-bank", element: <BloodBank /> },
  { path: "/chat", element: <Chat /> },  // Chat wrapper
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>          {/* ⬅ WRAP WHOLE APP */}
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
