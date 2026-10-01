import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import NotificationBell from "../../components/NotificationBell.jsx";
import AssistantPanel from "../../components/AssistantPanel.jsx";

const ROLE_LABELS = {
  faculty: "Faculty",
  hod: "Head of Department",
  iqac_admin: "IQAC Admin",
  super_admin: "Super Admin",
};

const NAV = [
  { to: "/dashboard", label: "Dashboard", end: true, roles: ["faculty", "hod", "iqac_admin", "super_admin"] },
  { to: "/dashboard/achievements", label: "My Achievements", roles: ["faculty", "hod", "iqac_admin", "super_admin"] },
  { to: "/dashboard/review", label: "Review Queue", roles: ["hod", "iqac_admin", "super_admin"] },
  { to: "/dashboard/faculty", label: "Faculty Directory", roles: ["hod", "iqac_admin", "super_admin"] },
  { to: "/dashboard/reports", label: "Reports", roles: ["iqac_admin", "super_admin"] },
  { to: "/dashboard/alumni", label: "Alumni Archive", roles: ["hod", "iqac_admin", "super_admin"] },
  { to: "/dashboard/departments", label: "Departments", roles: ["super_admin"] },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const links = NAV.filter((item) => item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_2px_15px_rgba(0,0,0,0.04)]">
        <div className="h-16 max-w-[1680px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="xl:hidden h-9 w-9 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              <Icon name={mobileNavOpen ? "close" : "menu"} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg tracking-tight">
              F
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-lg tracking-tight text-slate-900 font-bold leading-none">FAEMS</span>
              <span className="text-[10px] font-semibold text-blue-600 tracking-wider uppercase mt-0.5">
                Accreditation Core
              </span>
            </div>
          </div>

          <nav className="hidden xl:flex items-center gap-1.5">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `transition-colors rounded-lg text-sm font-semibold px-3.5 py-1.5 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                      : "text-slate-600 hover:text-blue-600 hover:bg-slate-100/70"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((m) => !m)}
                className="flex items-center gap-2 rounded-full pl-1 pr-1 sm:pr-3 py-1 hover:bg-slate-100 transition"
              >
                <span className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shrink-0">
                  <span className="h-full w-full rounded-full bg-white grid place-items-center text-blue-700 text-xs font-bold">
                    {user.full_name?.[0] ?? "U"}
                  </span>
                </span>
                <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.full_name}</span>
                <Icon name="expand_more" className="hidden sm:block text-slate-400" size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-card-lg py-1.5 z-10">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      {ROLE_LABELS[user.role]}
                    </p>
                    <p className="text-sm font-medium text-slate-800 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-3.5 py-2 text-sm text-rose-600 hover:bg-rose-50 transition flex items-center gap-2"
                  >
                    <Icon name="logout" size={17} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mobileNavOpen && (
          <nav className="xl:hidden border-t border-slate-100 px-4 py-3 flex flex-col gap-1 bg-white">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg text-sm font-semibold px-3.5 py-2.5 transition ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <AssistantPanel />
    </div>
  );
}
