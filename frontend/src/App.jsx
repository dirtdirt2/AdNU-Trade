
import { useEffect, useState } from "react";
import LoginPage from "./LoginPage.jsx";
import RegisterPage from "./RegisterPage.jsx";
import HomePage from "./HomePage.jsx";
import TransactionPage from "./TransactionPage.jsx";
import MessagesPage from "./MessagesPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import AdminPage from "./AdminPage.jsx";
import NotificationsPage from "./NotificationsPage.jsx";

const getInitialRoute = () => {
  const hash = window.location.hash;
  return !hash || hash === "#/" ? "#/home" : hash;
};

export default function App() {
  const [route, setRoute] = useState(getInitialRoute);

  useEffect(() => {
    const onChange = () => {
      const currentHash = window.location.hash || "#/home";

      // The app root now opens the public marketplace.
      if (currentHash === "#/") {
        window.location.hash = "#/home";
        return;
      }

      const protectedRoutes = [
        "#/listings",
        "#/saved",
        "#/transactions",
        "#/transaction",
        "#/profile",
        "#/admin",
        "#/notifications",
      ];

      const isProtectedRoute =
        protectedRoutes.includes(currentHash) ||
        currentHash.startsWith("#/messages");

      const hasToken =
        !!localStorage.getItem("token") ||
        !!sessionStorage.getItem("token");

      if (isProtectedRoute && !hasToken) {
        window.location.hash = "#/login";
        return;
      }

      setRoute(currentHash);
      window.scrollTo(0, 0);
    };

    window.addEventListener("hashchange", onChange);
    onChange();

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (route === "#/login") {
    return <LoginPage />;
  }

  if (route === "#/register") {
    return (
      <RegisterPage
        onSwitchToLogin={() => {
          window.location.hash = "#/login";
        }}
      />
    );
  }

  if (
    route === "#/home" ||
    route === "#/listings" ||
    route === "#/saved" ||
    route === "#/transactions"
  ) {
    return <HomePage />;
  }

  if (route === "#/transaction") return <TransactionPage />;
  if (route.startsWith("#/messages")) return <MessagesPage />;
  if (route === "#/profile") return <ProfilePage />;
  if (route === "#/notifications") return <NotificationsPage />;
  if (route === "#/admin") return <AdminPage />;

  // Unknown routes return visitors to the public marketplace.
  return <HomePage />;
}
