// File: src/components/Navbar.tsx

import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { Bell, Clock, CheckCircle, PlusCircle, X, Sun, Moon, Sparkles, LogOut, User } from "lucide-react";
import logo from "../assets/logo.png";
import { logout, getUnreadAlerts, acknowledgeAlert } from "../api/apiClient";
import type { Alert } from "../types";
import dayjs from "dayjs";
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTheme } from "../theme/ThemeContext";
dayjs.extend(duration);
dayjs.extend(relativeTime);

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/analytics", label: "Analytics" },
  { to: "/expenses", label: "Expenses" },
  { to: "/budgets", label: "Budgets" },
  { to: "/merchants", label: "Merchants" },
  { to: "/settings", label: "Settings" },
];

const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<string | null>(null);

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = alerts.length;

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const updateTimer = () => {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        setSessionTimeLeft(null);
        return;
      }
      try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        const expirationTime = decodedPayload.exp * 1000;
        const now = new Date().getTime();
        const timeLeft = expirationTime - now;

        if (timeLeft > 0) {
          setSessionTimeLeft(dayjs.duration(timeLeft).format('mm:ss'));
        } else {
          setSessionTimeLeft("00:00");
        }
      } catch (error) {
        console.error("Failed to decode token for timer:", error);
        setSessionTimeLeft(null);
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const unreadAlerts = await getUnreadAlerts();
        setAlerts(unreadAlerts);
      } catch (error) {
        console.error("Failed to fetch alerts:", error);
      }
    };

    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const handleAcknowledgeAlert = async (alertId: number) => {
    setAlerts(prevAlerts => prevAlerts.filter(a => a.id !== alertId));
    try {
      await acknowledgeAlert(alertId);
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
    }
  };

  const handleNewCategoryAlertClick = (alert: Alert) => {
    if (alert.context?.category_name) {
      navigate('/settings', { state: { newCategoryName: alert.context.category_name } });
      setIsAlertsOpen(false);
      handleAcknowledgeAlert(alert.id);
    }
  };

  const renderAlertContent = (alert: Alert) => {
    if (alert.type === 'new_category' && alert.context?.category_name) {
      return (
        <div key={alert.id} className="p-3 border-b border-hair hover:bg-hair/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full border-1.5 border-line bg-candy-lilac flex items-center justify-center shrink-0 mt-0.5" />
          <div className="flex-grow">
            <p className="text-sm font-body">New category found: <strong className="font-heading">{alert.context.category_name}</strong></p>
            <p className="text-xs font-body text-faint mt-1">{dayjs(alert.triggered_at).fromNow()}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => handleAcknowledgeAlert(alert.id)} title="Dismiss" className="p-1 text-muted hover:text-semantic-red">
              <X size={18} />
            </button>
            <button onClick={() => handleNewCategoryAlertClick(alert)} title="Add this category" className="p-1 text-muted hover:text-semantic-green">
              <PlusCircle size={18} />
            </button>
          </div>
        </div>
      );
    }

    if (alert.type === 'budget' && alert.goal) {
      return (
        <div key={alert.id} className="p-3 border-b border-hair hover:bg-hair/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full border-1.5 border-line bg-candy-coral flex items-center justify-center shrink-0 mt-0.5" />
          <div className="flex-grow">
            <p className="text-sm font-body">
              You've used {alert.threshold_percentage}% of your <strong className="font-heading">{alert.goal?.category?.name || 'a'}</strong> budget for {dayjs(alert.goal?.month + "-01").format("MMMM")}.
            </p>
            <p className="text-xs font-body text-faint mt-1">{dayjs(alert.triggered_at).fromNow()}</p>
          </div>
          <button onClick={() => handleAcknowledgeAlert(alert.id)} title="Mark as read" className="p-1 text-muted hover:text-semantic-green shrink-0">
            <CheckCircle size={18} />
          </button>
        </div>
      );
    }

    // TODO(Part 2): render alert.type === 'new_merchant' the same visual way,
    // with accept -> apply the suggested merchant/category, dismiss -> acknowledge.

    return null;
  };

  return (
    <header className="h-[70px] px-6 flex items-center justify-between sticky top-0 z-40 bg-nav border-b-2 border-line">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[13px] border-2 border-line shadow-card bg-[#151806] flex items-center justify-center shrink-0 overflow-hidden">
          <img src={logo} alt="ExpenseTracker" className="h-6 w-6 object-contain" />
        </div>
        <div className="hidden sm:flex flex-col leading-none">
          <span className="font-heading font-extrabold text-[17px] text-ink">ExpenseTracker</span>
          <span className="font-body font-semibold text-[8px] uppercase tracking-[0.2em] text-muted mt-1">Spend smarter</span>
        </div>
      </div>

      <nav className="hidden md:flex items-center gap-1.5">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "px-3.5 py-2 rounded-full text-sm font-body font-semibold transition-all duration-chip",
                isActive
                  ? "bg-candy-yellow border-1.5 border-line shadow-chip text-[#1E1B16]"
                  : "opacity-55 hover:opacity-100 text-ink",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2.5">
        {sessionTimeLeft && (
          <div className="hidden lg:flex items-center text-xs font-mono text-muted gap-1" title="Session time remaining">
            <Clock size={14} />
            <span>{sessionTimeLeft}</span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-10 h-10 rounded-full border-1.5 border-line flex items-center justify-center hover:bg-hair transition-colors"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Assistant entry point -- panel wired live in Part 3 */}
        <button
          aria-label="Ask the assistant"
          title="Assistant"
          className="w-10 h-10 rounded-[14px] border-1.5 border-line bg-candy-lilac shadow-chip flex items-center justify-center text-[#1E1B16] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
        >
          <Sparkles size={17} />
        </button>

        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setIsAlertsOpen(!isAlertsOpen)}
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-full border-1.5 border-line flex items-center justify-center hover:bg-hair transition-colors"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full border-1.5 border-line bg-candy-coral text-[10px] font-body font-bold text-[#1E1B16]">
                {unreadCount}
              </span>
            )}
          </button>
          {isAlertsOpen && (
            <div className="absolute right-0 mt-2 w-[378px] bg-card text-ink border-2 border-line rounded-cardLg shadow-overlay z-50 max-h-96 overflow-y-auto">
              <div className="p-3.5 font-heading font-bold text-sm border-b-2 border-line flex items-center justify-between">
                <span>Notifications</span>
                {unreadCount > 0 && <span className="text-xs font-body text-muted">{unreadCount} unread</span>}
              </div>
              {alerts.length > 0 ? (
                alerts.map(alert => renderAlertContent(alert))
              ) : (
                <p className="p-6 text-sm font-body text-center text-muted">You're all caught up!</p>
              )}
              <Link
                to="/merchants"
                onClick={() => setIsAlertsOpen(false)}
                className="block p-3 text-center text-sm font-body font-semibold text-link hover:underline border-t-2 border-line"
              >
                View Merchants →
              </Link>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-label="Account menu"
            className="w-10 h-10 rounded-full border-1.5 border-line bg-candy-pink shadow-chip flex items-center justify-center text-[#1E1B16]"
          >
            <User size={17} />
          </button>
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-card text-ink border-2 border-line rounded-card shadow-overlay py-1 z-50">
              <Link to="/profile" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-body font-medium hover:bg-hair">
                <User size={15} /> Your profile
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm font-body font-medium hover:bg-hair">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
