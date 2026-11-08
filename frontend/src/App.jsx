import { useEffect, useState } from "react";
import LoginPage from "./LoginPage.jsx";
import RegisterPage from "./RegisterPage.jsx";
import HomePage from "./HomePage.jsx";
import TransactionPage from "./TransactionPage.jsx";
import MessagesPage from "./MessagesPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import AdminPage from "./AdminPage.jsx";
import NotificationsPage from "./NotificationsPage.jsx";

export default function App() {
  const [route, setRoute] = useState(window.location.hash || "#/");

  useEffect(() => {
    // Auto-redirect to home ONLY if token exists
    const rememberedToken = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (rememberedToken && (window.location.hash === "" || window.location.hash === "#/")) {
      window.location.hash = "#/home";
    }

    const onChange = () => {
      const currentHash = window.location.hash || "#/";
      const protectedRoutes = ["#/home", "#/listings", "#/saved", "#/transactions", "#/transaction", "#/profile", "#/admin", "#/notifications"];
      const isProtectedRoute = protectedRoutes.includes(currentHash) || currentHash.startsWith("#/messages");

      // Auth guard for manual URL typing
      const hasToken = !!localStorage.getItem("token") || !!sessionStorage.getItem("token");
      if (isProtectedRoute && !hasToken) {
        window.location.hash = "#/";
        return;
      }

      setRoute(currentHash);
      window.scrollTo(0, 0);
    };

    window.addEventListener("hashchange", onChange);
    onChange();

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (route === "#/register") {
    return <RegisterPage onSwitchToLogin={() => { window.location.hash = "#/"; }} />;
  }

  // Render routes based on hash
  if (route === "#/home" || route === "#/listings" || route === "#/saved" || route === "#/transactions") {
    return <HomePage />;
  }
  if (route === "#/transaction") return <TransactionPage />;
  if (route.startsWith("#/messages")) return <MessagesPage />;
  if (route === "#/profile") return <ProfilePage />;
  if (route === "#/notifications") return <NotificationsPage />;
  if (route === "#/admin") return <AdminPage />;

  return <LoginPage />;
}