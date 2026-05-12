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
}

const NAV: NavEntry[] = [
  {
    key: "/admin/dashboard",
    label: "Дашборд",
    icon: <DashboardOutlined />,
    roles: ["super_admin", "admin", "teacher"],
  },
  {
    key: "/admin/groups",
    label: "Группы",
    icon: <AppstoreOutlined />,
    roles: ["super_admin", "admin"],
  },
  {
    key: "/admin/children",
    label: "Дети",
    icon: <UserOutlined />,
    roles: ["super_admin", "admin", "teacher"],
  },
  {
    key: "/admin/attendance",
    label: "Посещаемость",
    icon: <CheckCircleOutlined />,
    roles: ["super_admin", "admin", "teacher"],
  },
  {
    key: "/admin/payments",
    label: "Оплата",
    icon: <WalletOutlined />,
    roles: ["super_admin", "admin", "teacher"],
  },
  {
    key: "/admin/expenses",
    label: "Расходы",
    icon: <PieChartOutlined />,
    roles: ["super_admin", "admin"],
  },
  {
    key: "/admin/analytics",
    label: "Аналитика",
    icon: <RiseOutlined />,
    roles: ["super_admin", "admin"],
  },
  {
    key: "/admin/staff",
    label: "Сотрудники",
    icon: <TeamOutlined />,
    roles: ["super_admin", "admin"],
  },
  {
    key: "/admin/teachers",
    label: "Учителя",
    icon: <TeamOutlined />,
    roles: ["super_admin", "admin"],
  },
  {
    key: "/admin/schedule",
    label: "Расписание",
    icon: <CalendarOutlined />,
    roles: ["super_admin", "admin", "teacher"],
  },
  {
    key: "/admin/menu",
    label: "Меню",
    icon: <CoffeeOutlined />,
    roles: ["super_admin", "admin", "teacher"],
  },
  {
    key: "/admin/settings",
    label: "Настройки",
    icon: <SettingOutlined />,
    roles: ["super_admin", "admin"],
  },
];

interface Props {
  collapsed: boolean;
}

export default function AppSidebar({ collapsed }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const items = NAV.filter((n) => user && n.roles.includes(user.role)).map(
    (n) => ({
      key: n.key,
      label: n.label,
      icon: n.icon,
    }),
  );

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
        mode="vertical"
        selectedKeys={[activeKey]}
        items={items}
        onClick={({ key }) => navigate(key as string)}
        style={{
          background: "transparent",
          border: "none",
          flex: 1,
          overflowY: "auto",
        }}
        inlineCollapsed={collapsed}
        
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
