import { useMemo, useState } from "react";
import {
  Card,
  Col,
  Row,
  Tabs,
  Typography,
  Tag,
  Table,
  Space,
  Avatar,
  Statistic,
  Result,
  Button,
  Progress,
  DatePicker,
  Tooltip,
} from "antd";
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  WalletOutlined,
  PieChartOutlined,
} from "@ant-design/icons";
import { Pie, Column, Area } from "@ant-design/charts";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import dayjs from "dayjs";

import { useDataStore } from "../store/dataStore";
import { LayoutGrid } from "lucide-react";
import { SP, SproutPageHeader } from "../components/sprout";
import StatCard from "../components/ui/StatCard";
import { calcGroupFinances } from "../lib/finance";
import { calcAge, formatMoney, formatPercent } from "../lib/format";
import type { Child, Expense, Payment } from "../types";

const { Text, Title } = Typography;

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const groups = useDataStore((s) => s.groups);
  const children = useDataStore((s) => s.children);
  const payments = useDataStore((s) => s.payments);
  const expenses = useDataStore((s) => s.expenses);
  const attendance = useDataStore((s) => s.attendance);
  const staff = useDataStore((s) => s.staff);
  const extraIncome = useDataStore((s) => s.extraIncome);

  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));

  const group = groups.find((g) => g.id === id);
  const teacher = group?.teacherId
    ? staff.find((s) => s.id === group.teacherId)
    : undefined;

  const finance = useMemo(() => {
    if (!group) return null;
    return calcGroupFinances({
      groups,
      children,
      payments,
      expenses,
      extraIncome,
      attendance,
      month,
    }).find((f) => f.group.id === group.id);
  }, [
    groups,
    group,
    children,
    payments,
    expenses,
    extraIncome,
    attendance,
    month,
  ]);

  const groupChildren: Child[] = useMemo(
    () => children.filter((c) => c.groupId === id),
    [children, id],
  );
  const groupPayments: Payment[] = useMemo(
    () =>
      payments.filter(
        (p) =>
          groupChildren.some((c) => c.id === p.childId) && p.month === month,
      ),
    [payments, groupChildren, month],
  );
  const groupExpenses: Expense[] = useMemo(
    () => expenses.filter((e) => e.groupId === id && e.month === month),
    [expenses, id, month],
  );

  // 6-месячный тренд прибыли для группы
  const trend = useMemo(() => {
    if (!group) return [];
    const arr: { month: string; profit: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = dayjs().subtract(i, "month").format("YYYY-MM");
      const f = calcGroupFinances({
        groups,
        children,
        payments,
        expenses,
        extraIncome,
        attendance,
        month: m,
      }).find((x) => x.group.id === group.id);
      arr.push({
        month: dayjs(m + "-01").format("MMM"),
        profit: f?.profit ?? 0,
      });
    }
    return arr;
  }, [group, groups, children, payments, expenses, extraIncome, attendance]);

  if (!group) {
    return (
      <Result
        status="404"
        title="Группа не найдена"
        extra={
          <Button type="primary" onClick={() => navigate("/admin/groups")}>
            К списку
          </Button>
        }
      />
    );
  }

  const f = finance!;

  // Диаграмма «оплатили / должники»
  const paidVsDebt = [
    { type: "Оплатили", value: f.paidCount },
    { type: "Должники", value: f.debtorsCount },
  ].filter((x) => x.value > 0);

  // Распределение расходов группы по категориям
  const expenseByCategory = (() => {
    const map = new Map<string, number>();
    groupExpenses.forEach((e) =>
      map.set(e.category, (map.get(e.category) || 0) + e.amount),
    );
    // Добавим долю общих расходов как «Общие (доля)»
    const commonShare =
      f.expenses -
      groupExpenses.reduce((s, e) => s + e.amount, 0) -
      (group.fixedMonthlyExpense || 0);
    if (commonShare > 0) map.set("Общие (доля)", commonShare);
    if (group.fixedMonthlyExpense)
      map.set("Фикс. расходы группы", group.fixedMonthlyExpense);
    return Array.from(map.entries()).map(([type, value]) => ({ type, value }));
  })();

  return (
    <div>
      <SproutPageHeader
        title={
          <Space>
            <Avatar
              style={{ background: group.color, fontWeight: 700 }}
            >
              {group.name.slice(0, 1).toUpperCase()}
            </Avatar>
            {group.name}
            <Tag
              style={{
                background: f.profit >= 0 ? SP.primaryGhost : '#FCEAE5',
                color: f.profit >= 0 ? SP.primaryDeep : SP.danger,
                border: 'none',
                fontWeight: 600,
              }}
            >
              {f.profit >= 0 ? "Выгодная" : "Убыточная"}
            </Tag>
          </Space>
        }
        icon={<LayoutGrid size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description={`Возраст: ${group.ageRange}${teacher ? ` · Воспитатель: ${teacher.lastName} ${teacher.firstName}` : ""}`}
        actions={
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(month + "-01")}
              onChange={(d) => d && setMonth(d.format("YYYY-MM"))}
              allowClear={false}
            />
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/admin/groups")}
            >
              К группам
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard
            title="Детей"
            value={f.childrenCount}
            icon={<TeamOutlined />}
            variant="primary"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Оплатили"
            value={f.paidCount}
            icon={<CheckCircleOutlined />}
            variant="success"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Должники"
            value={f.debtorsCount}
            icon={<CloseCircleOutlined />}
            variant="danger"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Посещаемость"
            value={Math.round(f.attendanceRate * 100)}
            suffix="%"
            variant="primary"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass kpi-gradient-emerald p-5"
          >
            <Text type="secondary">Доход группы</Text>
            <Statistic
              value={f.income}
              suffix=" сомони"
              precision={0}
              valueStyle={{ fontWeight: 700 }}
            />
          </motion.div>
        </Col>
        <Col xs={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="glass kpi-gradient-amber p-5"
          >
            <Text type="secondary">Расходы группы</Text>
            <Statistic
              value={f.expenses}
              suffix=" сомони"
              precision={0}
              valueStyle={{ fontWeight: 700 }}
            />
          </motion.div>
        </Col>
        <Col xs={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={`glass p-5 ${f.profit >= 0 ? "kpi-gradient" : "kpi-gradient-rose"}`}
          >
            <Text type="secondary">Чистая прибыль</Text>
            <Statistic
              value={f.profit}
              suffix=" сомони"
              precision={0} // Округлит до целых (напр. 10.5 -> 11)
              valueStyle={{
                fontWeight: 700,
                color: f.profit >= 0 ? "#10b981" : "#f43f5e",
              }}
            />
            <div className="mt-2">
              <Progress
                percent={Math.max(0, Math.min(100, f.margin * 100 + 50))}
                size="small"
                strokeColor={f.profit >= 0 ? "#10b981" : "#f43f5e"}
                format={() => `маржа ${formatPercent(f.margin)}`}
              />
            </div>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card className="glass" bordered={false}>
            <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
              <PieChartOutlined /> Структура расходов
            </Title>
            {expenseByCategory.length > 0 ? (
              <Pie
                data={expenseByCategory}
                angleField="value"
                colorField="type"
                radius={0.9}
                innerRadius={0.55}
                height={260}
                legend={{ position: "bottom" }}
              />
            ) : (
              <Text type="secondary">Нет расходов</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="glass" bordered={false}>
            <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
              Динамика прибыли (6 мес.)
            </Title>
            <Area
              data={trend}
              xField="month"
              yField="profit"
              //@ts-ignore
              smooth
              height={260}
              color="#6366f1"
              areaStyle={{ fillOpacity: 0.3 }}
              animation={{ appear: { animation: "wave-in", duration: 900 } }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="glass mt-4" bordered={false}>
        <Tabs
          items={[
            {
              key: "children",
              label: `Дети (${groupChildren.length})`,
              children: (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 8 }}
                  dataSource={groupChildren}
                  columns={[
                    {
                      title: "ФИО",
                      key: "fio",
                      render: (_: unknown, c: Child) => (
                        <Space>
                          <Avatar size={28} style={{ background: "#6366f1" }}>
                            {c.firstName[0]}
                          </Avatar>
                          <span>
                            {c.lastName} {c.firstName}
                          </span>
                        </Space>
                      ),
                    },
                    {
                      title: "Возраст",
                      key: "age",
                      render: (_: unknown, c: Child) =>
                        `${calcAge(c.birthDate)} л.`,
                    },
                    {
                      title: "Родитель",
                      key: "parent",
                      render: (_: unknown, c: Child) =>
                        c.motherName || c.fatherName || "—",
                    },
                    {
                      title: "Телефон",
                      key: "phone",
                      render: (_: unknown, c: Child) =>
                        c.motherPhone || c.fatherPhone || "—",
                    },
                  ]}
                />
              ),
            },
            {
              key: "attendance",
              label: "Посещаемость",
              children: (() => {
                const dataByDay = new Map<
                  string,
                  { present: number; absent: number }
                >();
                attendance
                  .filter((a) => groupChildren.some((c) => c.id === a.childId))
                  .forEach((a) => {
                    const d = dataByDay.get(a.date) || {
                      present: 0,
                      absent: 0,
                    };
                    if (a.status === "present") d.present++;
                    else d.absent++;
                    dataByDay.set(a.date, d);
                  });
                const chartData = Array.from(dataByDay.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(-10)
                  .flatMap(([date, v]) => [
                    { date, type: "Присутствовали", value: v.present },
                    { date, type: "Отсутствовали", value: v.absent },
                  ]);
                return chartData.length > 0 ? (
                  <Column
                    data={chartData}
                    xField="date"
                    yField="value"
                    seriesField="type"
                    isStack
                    height={300}
                    color={["#10b981", "#f43f5e"]}
                  />
                ) : (
                  <Text type="secondary">Нет данных о посещаемости</Text>
                );
              })(),
            },
            {
              key: "payments",
              label: `Оплата (${groupPayments.length})`,
              children: (
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={groupPayments}
                  columns={[
                    {
                      title: "Ребёнок",
                      key: "child",
                      render: (_: unknown, row: Payment) => {
                        const c = groupChildren.find(
                          (x) => x.id === row.childId,
                        );
                        return c ? `${c.lastName} ${c.firstName}` : "—";
                      },
                    },
                    {
                      title: "Сумма",
                      dataIndex: "amount",
                      render: (v: number) => formatMoney(v),
                    },
                    {
                      title: "Статус",
                      key: "status",
                      render: (_: unknown, p: Payment) =>
                        p.paid ? (
                          <Tag color="green">Оплачено</Tag>
                        ) : (
                          <Tag color="volcano">Должник</Tag>
                        ),
                    },
                    {
                      title: "Способ",
                      dataIndex: "method",
                      render: (v?: string) => (v ? <Tag>{v}</Tag> : "—"),
                    },
                  ]}
                />
              ),
            },
            {
              key: "expenses",
              label: "Расходы группы",
              children: (
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={groupExpenses}
                  columns={[
                    { title: "Категория", dataIndex: "category" },
                    { title: "Описание", dataIndex: "description" },
                    {
                      title: "Сумма",
                      dataIndex: "amount",
                      render: (v: number) => formatMoney(v),
                    },
                  ]}
                />
              ),
            },
            {
              key: "finance",
              label: "Финансовая диагностика",
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card className="glass" bordered={false}>
                      <Title level={5}>
                        <WalletOutlined /> Оплата / долги
                      </Title>
                      {paidVsDebt.length > 0 ? (
                        <Pie
                          data={paidVsDebt}
                          angleField="value"
                          colorField="type"
                          radius={0.9}
                          height={260}
                          color={["#10b981", "#f43f5e"]}
                          legend={{ position: "bottom" }}
                        />
                      ) : (
                        <Text type="secondary">Нет данных</Text>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card className="glass" bordered={false}>
                      <Title level={5}>Итог по группе</Title>
                      <Tooltip title="Группа считается выгодной, если прибыль положительна">
                        <Tag
                          color={f.profit >= 0 ? "green" : "red"}
                          style={{ fontSize: 14, padding: "4px 10px" }}
                        >
                          {f.profit >= 0
                            ? `Группа выгодна: +${formatMoney(f.profit)} прибыли в месяц`
                            : `Группа убыточна: ${formatMoney(f.profit)} потерь в месяц`}
                        </Tag>
                      </Tooltip>
                      <ul className="mt-3 space-y-1 text-sm">
                        <li>
                          Доход: <Text strong>{formatMoney(f.income)}</Text>
                        </li>
                        <li>
                          Расход: <Text strong>{formatMoney(f.expenses)}</Text>
                        </li>
                        <li>
                          Маржа:{" "}
                          <Text
                            strong
                            style={{
                              color: f.profit >= 0 ? "#10b981" : "#f43f5e",
                            }}
                          >
                            {formatPercent(f.margin)}
                          </Text>
                        </li>
                        <li>
                          Посещаемость:{" "}
                          <Text strong>{formatPercent(f.attendanceRate)}</Text>
                        </li>
                      </ul>
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
