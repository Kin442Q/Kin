import { Menu, Tooltip, Typography } from "antd";
import {
  LayoutDashboard,
  School,
  LayoutGrid,
  Baby,
  ClipboardCheck,
  Wallet,
  PieChart,
  TrendingUp,
  Users,
  GraduationCap,
  Calendar,
  Megaphone,
  UtensilsCrossed,
  Settings,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useAuthStore } from "../../store/authStore";
import type { Role } from "../../types";

const { Text } = Typography;

interface NavEntry {
  key: string;
  label: string;
  icon: ReactNode;
  /** CSS-класс для цветового акцента иконки */
  iconClass: string;
  roles: Role[];
  /** Если true — показывается только глобальному супер-админу (kindergartenId === null) */
  globalOnly?: boolean;
}

const ICON_SIZE = 20;

const NAV: NavEntry[] = [
  {
    key: "/admin/kindergartens",
    label: "Садики",
    icon: <School size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-pink",
    roles: ["SUPER_ADMIN"],
    globalOnly: true,
  },
  {
    key: "/admin/dashboard",
    label: "Дашборд",
    icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-indigo",
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/groups",
    label: "Группы",
    icon: <LayoutGrid size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-violet",
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/children",
    label: "Дети",
    icon: <Baby size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-pink",
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/attendance",
    label: "Посещаемость",
    icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-emerald",
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/payments",
    label: "Оплата",
    icon: <Wallet size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-amber",
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/expenses",
    label: "Расходы",
    icon: <PieChart size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-red",
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/analytics",
    label: "Аналитика",
    icon: <TrendingUp size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-cyan",
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/staff",
    label: "Сотрудники",
    icon: <Users size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-blue",
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/TEACHERs",
    label: "Учителя",
    icon: <GraduationCap size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-purple",
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/schedule",
    label: "Расписание",
    icon: <Calendar size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-indigo",
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/meetings",
    label: "Собрания",
    icon: <Megaphone size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-violet",
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/menu",
    label: "Меню",
    icon: <UtensilsCrossed size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-amber",
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/settings",
    label: "Настройки",
    icon: <Settings size={ICON_SIZE} strokeWidth={2} />,
    iconClass: "icon-blue",
    roles: ["SUPER_ADMIN", "admin"],
  },
];

interface Props {
  collapsed: boolean;
}

export default function AppSidebar({ collapsed }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const isGlobalOwner = !!user && !user.kindergartenId;

  const items = NAV.filter((n) => {
    if (!user) return false;
    if (!n.roles.includes(user.role)) return false;
    if (n.globalOnly && !isGlobalOwner) return false;
    return true;
  }).map((n) => ({
    key: n.key,
    label: collapsed ? (
      <Tooltip title={n.label} placement="right">
        <span>{n.label}</span>
      </Tooltip>
    ) : (
      n.label
    ),
    icon: <span className={n.iconClass}>{n.icon}</span>,
  }));

  const activeKey =
    items.find((i) => location.pathname.startsWith(i.key))?.key ??
    "/admin/dashboard";

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass h-full flex flex-col"
      style={{ padding: collapsed ? 8 : 16 }}
    >
      {/* Логотип */}
      <div
        className="flex items-center mb-4"
        style={{
          gap: collapsed ? 0 : 10,
          padding: collapsed ? 0 : "4px 8px",
          justifyContent: collapsed ? "center" : "flex-start",
          minHeight: 44,
        }}
      >
        <motion.span
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ repeat: Infinity, repeatDelay: 6, duration: 1.2 }}
          style={{ fontSize: 28, lineHeight: 1, display: "inline-flex" }}
        >
          🌸
        </motion.span>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div className="font-semibold text-base logo-gradient">
              KinderCRM
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Управление детским садом
            </Text>
          </div>
        )}
      </div>

      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[activeKey]}
        items={items}
        onClick={({ key }) => navigate(key as string)}
        className="nav-menu"
        style={{
          background: "transparent",
          border: "none",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      />

      {!collapsed && (
        <div
          className="mt-3 flex items-center justify-center"
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.10))",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-primary)",
            opacity: 0.85,
          }}
        >
          ✨ v2.0 · 2026
        </div>
      )}
    </motion.div>
  );
}
