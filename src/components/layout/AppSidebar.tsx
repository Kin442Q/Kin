import { Menu, Typography, Tag } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  AppstoreOutlined,
  WalletOutlined,
  PieChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  CoffeeOutlined,
  SettingOutlined,
  UserOutlined,
  BankOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import type { Role } from "../../types";

const { Text } = Typography;

interface NavEntry {
  key: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
  /** Если true — показывается только глобальному супер-админу (kindergartenId === null) */
  globalOnly?: boolean;
}

const NAV: NavEntry[] = [
  {
    key: "/admin/kindergartens",
    label: "Садики",
    icon: <BankOutlined />,
    roles: ["SUPER_ADMIN"],
    globalOnly: true,
  },
  {
    key: "/admin/dashboard",
    label: "Дашборд",
    icon: <DashboardOutlined />,
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/groups",
    label: "Группы",
    icon: <AppstoreOutlined />,
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/children",
    label: "Дети",
    icon: <UserOutlined />,
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/attendance",
    label: "Посещаемость",
    icon: <CheckCircleOutlined />,
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/payments",
    label: "Оплата",
    icon: <WalletOutlined />,
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/expenses",
    label: "Расходы",
    icon: <PieChartOutlined />,
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/analytics",
    label: "Аналитика",
    icon: <RiseOutlined />,
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/staff",
    label: "Сотрудники",
    icon: <TeamOutlined />,
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/TEACHERs",
    label: "Учителя",
    icon: <TeamOutlined />,
    roles: ["SUPER_ADMIN", "admin"],
  },
  {
    key: "/admin/schedule",
    label: "Расписание",
    icon: <CalendarOutlined />,
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/meetings",
    label: "Собрания",
    icon: <TeamOutlined />,
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/menu",
    label: "Меню",
    icon: <CoffeeOutlined />,
    roles: ["SUPER_ADMIN", "admin", "TEACHER"],
  },
  {
    key: "/admin/settings",
    label: "Настройки",
    icon: <SettingOutlined />,
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
    // globalOnly пункты видны только владельцу платформы (kindergartenId = null)
    if (n.globalOnly && !isGlobalOwner) return false;
    return true;
  }).map((n) => ({
    key: n.key,
    label: n.label,
    icon: n.icon,
  }));

  // Подсветка активного пункта по началу пути
  const activeKey =
    items.find((i) => location.pathname.startsWith(i.key))?.key ??
    "/admin/dashboard";

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass h-full flex flex-col"
      style={{ padding: 16 }}
    >
      <div className="flex items-center gap-2 px-2 py-1 mb-4">
        <motion.span
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ repeat: Infinity, repeatDelay: 6, duration: 1.2 }}
          className="text-2xl"
        >
          🌸
        </motion.span>
        {!collapsed && (
          <div>
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
        // inlineCollapsed={collapsed}
      />

      {!collapsed && (
        <div className="mt-2 px-2">
          <Tag color="purple" style={{ borderRadius: 999 }}>
            v2.0 · 2026
          </Tag>
        </div>
      )}
    </motion.div>
  );
}
