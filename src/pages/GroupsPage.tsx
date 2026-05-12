import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Avatar,
  Select,
  DatePicker,
  App as AntdApp,
  Tooltip,
} from "antd";
import {
  AppstoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  RiseOutlined,
  EyeOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Column, Pie, Bar } from "@ant-design/charts";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import PageHeader from "../components/PageHeader";
import { useDataStore } from "../store/dataStore";
import type { Group, GroupFinance } from "../types";
import { calcGroupFinances } from "../lib/finance";
import { formatMoney, formatPercent } from "../lib/format";
import { uid } from "../lib/uid";

const { Text, Title } = Typography;

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#a855f7",
  "#06b6d4",
  "#ef4444",
  "#14b8a6",
];

/**
 * Страница «Группы».
 * Показывает по каждой группе: количество детей, оплативших, должников,
 * доход, расход, чистую прибыль, % посещаемости, а также диаграмму
 * «выгодности» (прибыль/убыток) — сразу видно, какая группа тащит, а
 * какая в минусе.
 */
export default function GroupsPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();

  const groups = useDataStore((s) => s.groups);
  const children = useDataStore((s) => s.children);
  const payments = useDataStore((s) => s.payments);
  const expenses = useDataStore((s) => s.expenses);
  const extraIncome = useDataStore((s) => s.extraIncome);
  const attendance = useDataStore((s) => s.attendance);
  const staff = useDataStore((s) => s.staff);
  const upsertGroup = useDataStore((s) => s.upsertGroup);
  const deleteGroup = useDataStore((s) => s.deleteGroup);

  const [month, setMonth] = useState<string>(dayjs().format("YYYY-MM"));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form] = Form.useForm();

  const finances = useMemo<GroupFinance[]>(
    () =>
      calcGroupFinances({
        groups,
        children,
        payments,
        expenses,
        extraIncome,
        attendance,
        month,
      }),
    [groups, children, payments, expenses, extraIncome, attendance, month],
  );

  const total = useMemo(() => {
    const income = finances.reduce((s, g) => s + g.income, 0);
    const exp = finances.reduce((s, g) => s + g.expenses, 0);
    const profit = income - exp;
    const profitable = finances.filter((g) => g.profit >= 0).length;
    return { income, exp, profit, profitable, count: finances.length };
  }, [finances]);

  // Диаграмма «выгодности групп»: прибыль по каждой группе
  const profitByGroupData = finances.map((g) => ({
    group: g.group.name,
    type: g.profit >= 0 ? "Прибыль" : "Убыток",
    value: Math.abs(g.profit),
    rawProfit: g.profit,
  }));

  // Доход vs Расход стэком
  const incomeVsExpenseData = finances.flatMap((g) => [
    { group: g.group.name, type: "Доход", value: g.income },
    { group: g.group.name, type: "Расход", value: g.expenses },
  ]);

  // Доля каждой группы в общем доходе
  const incomeShare = finances
    .filter((g) => g.income > 0)
    .map((g) => ({ type: g.group.name, value: g.income }));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      color: COLORS[groups.length % COLORS.length],
      monthlyFee: 1200,
      fixedMonthlyExpense: 6000,
    });
    setModalOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditing(g);
    form.setFieldsValue(g);
    setModalOpen(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const data: Group = {
        id: editing?.id ?? uid(),
        name: values.name,
        ageRange: values.ageRange,
        monthlyFee: Number(values.monthlyFee || 0),
        fixedMonthlyExpense: Number(values.fixedMonthlyExpense || 0),
        teacherId: values.teacherId,
        color: values.color || COLORS[0],
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      };
      upsertGroup(data);
      setModalOpen(false);
      message.success(editing ? "Группа обновлена" : "Группа создана");
    } catch {
      /* validation */
    }
  };

  const remove = (g: Group) => {
    deleteGroup(g.id);
    message.success(`Группа «${g.name}» удалена`);
  };

  const columns = [
    {
      title: "Группа",
      dataIndex: ["group", "name"],
      key: "name",
      render: (_: unknown, row: GroupFinance) => (
        <Space>
          <Avatar
            style={{ background: row.group.color }}
            icon={<TeamOutlined />}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{row.group.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.group.ageRange}
            </Text>
          </div>
        </Space>
      ),
      fixed: "left" as const,
    },
    {
      title: "Детей",
      dataIndex: "childrenCount",
      key: "childrenCount",
      sorter: (a: GroupFinance, b: GroupFinance) =>
        a.childrenCount - b.childrenCount,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Оплатили",
      dataIndex: "paidCount",
      key: "paidCount",
      render: (v: number, row: GroupFinance) => (
        <Tooltip title={`${v} из ${row.childrenCount}`}>
          <Tag color="green">{v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: "Должники",
      dataIndex: "debtorsCount",
      key: "debtorsCount",
      render: (v: number) =>
        v > 0 ? <Tag color="volcano">{v}</Tag> : <Tag>0</Tag>,
    },
    {
      title: "Доход",
      dataIndex: "income",
      key: "income",
      sorter: (a: GroupFinance, b: GroupFinance) => a.income - b.income,
      render: (v: number) => <Text strong>{formatMoney(v)}</Text>,
    },
    {
      title: "Расход",
      dataIndex: "expenses",
      key: "expenses",
      sorter: (a: GroupFinance, b: GroupFinance) => a.expenses - b.expenses,
      render: (v: number) => <Text type="secondary">{formatMoney(v)}</Text>,
    },
    {
      title: "Прибыль",
      dataIndex: "profit",
      key: "profit",
      sorter: (a: GroupFinance, b: GroupFinance) => a.profit - b.profit,
      defaultSortOrder: "descend" as const,
      render: (v: number) => (
        <Tag color={v >= 0 ? "green" : "red"} style={{ fontWeight: 600 }}>
          {v >= 0 ? "+" : ""}
          {formatMoney(v)}
        </Tag>
      ),
    },
    {
      title: "Маржа",
      dataIndex: "margin",
      key: "margin",
      render: (v: number, row: GroupFinance) => (
        <div style={{ minWidth: 110 }}>
          <Progress
            percent={Math.max(0, Math.min(100, v * 100))}
            size="small"
            strokeColor={row.profit >= 0 ? "#10b981" : "#f43f5e"}
            format={() => formatPercent(v)}
          />
        </div>
      ),
    },
    {
      title: "Посещаемость",
      dataIndex: "attendanceRate",
      key: "attendanceRate",
      render: (v: number) => (
        <div style={{ minWidth: 110 }}>
          <Progress
            percent={Math.round(v * 100)}
            size="small"
            strokeColor="#6366f1"
            format={(p) => `${p}%`}
          />
        </div>
      ),
    },
    {
      title: "Действия",
      key: "actions",
      fixed: "right" as const,
      render: (_: unknown, row: GroupFinance) => (
        <Space>
          <Tooltip title="Открыть">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/groups/${row.group.id}`)}
            />
          </Tooltip>
          <Tooltip title="Редактировать">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEdit(row.group)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить группу?"
            description="Дети группы останутся, но будут без группы"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => remove(row.group)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Группы"
        icon={<AppstoreOutlined />}
        description="Финансовая статистика по каждой группе — сразу видно, какая группа выгодна"
        actions={
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(month + "-01")}
              onChange={(d) => d && setMonth(d.format("YYYY-MM"))}
              allowClear={false}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Новая группа
            </Button>
          </Space>
        }
      />

      {/* Сводные KPI */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass p-4 kpi-gradient"
          >
            <Text type="secondary">Всего групп</Text>
            <Title level={3} style={{ margin: 0 }}>
              {total.count}
            </Title>
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="glass p-4 kpi-gradient-emerald"
          >
            <Text type="secondary">Доход всех групп</Text>
            <Title level={3} style={{ margin: 0 }}>
              {formatMoney(total.income)}
            </Title>
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="glass p-4 kpi-gradient-amber"
          >
            <Text type="secondary">Расходы всех групп</Text>
            <Title level={3} style={{ margin: 0 }}>
              {formatMoney(total.exp)}
            </Title>
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className={`glass p-4 ${total.profit >= 0 ? "kpi-gradient" : "kpi-gradient-rose"}`}
          >
            <Text type="secondary">Чистая прибыль</Text>
            <Title
              level={3}
              style={{
                margin: 0,
                color: total.profit >= 0 ? "#10b981" : "#f43f5e",
              }}
            >
              {total.profit >= 0 ? "+" : ""}
              {formatMoney(total.profit)}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Выгодных групп: {total.profitable} / {total.count}
            </Text>
          </motion.div>
        </Col>
      </Row>

      {/* Графики выгодности */}
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="glass" bordered={false}>
              <div className="flex items-center justify-between mb-3">
                <Title level={5} style={{ margin: 0 }}>
                  <RiseOutlined /> Прибыль по группам
                </Title>
                <Tag color="purple">выгодность</Tag>
              </div>
              <Column
                data={finances.map((g) => ({
                  group: g.group.name,
                  value: g.profit,
                  type: g.profit >= 0 ? "Прибыль" : "Убыток",
                }))}
                xField="group"
                yField="value"
                seriesField="type"
                color={({ type }: { type: string }) =>
                  type === "Прибыль" ? "#10b981" : "#f43f5e"
                }
                columnStyle={{ radius: [10, 10, 0, 0] }}
                height={280}
                label={{
                  position: "top",
                  formatter: (d: { value: number }) => formatMoney(d.value),
                  style: { fontSize: 11 },
                }}
                animation={{ appear: { animation: "wave-in", duration: 900 } }}
                legend={{ position: "top-right" }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="glass" bordered={false}>
              <div className="flex items-center justify-between mb-3">
                <Title level={5} style={{ margin: 0 }}>
                  <WalletOutlined /> Доход vs Расход
                </Title>
                <Tag color="geekblue">сравнение</Tag>
              </div>
              <Bar
                data={incomeVsExpenseData}
                xField="value"
                yField="group"
                seriesField="type"
                isGroup
                marginRatio={0.1}
                height={280}
                color={["#10b981", "#f59e0b"]}
                animation={{ appear: { animation: "fade-in", duration: 700 } }}
                legend={{ position: "top-right" }}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="glass w-[1200px]" bordered={false}>
              <Title level={5} style={{ margin: 0, marginBottom: 12 }}>
                Доля группы в доходе
              </Title>
              {incomeShare.length > 0 ? (
                <Pie
                  data={incomeShare}
                  angleField="value"
                  colorField="type"
                  radius={0.9}
                  innerRadius={0.55}
                  height={260}
                  legend={{ position: "bottom" }}
                  color={COLORS}
                />
              ) : (
                <Text type="secondary">Нет оплат за выбранный месяц</Text>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
      <Col xs={24} lg={16}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card className="glass w-[1200px] mt-3" bordered={false}>
            <div className="flex items-center justify-between mb-3">
              <Title level={5} style={{ margin: 0 }}>
                Подробно по группам
              </Title>
              <Text type="secondary">
                Месяц: <Tag>{dayjs(month + "-01").format("MMMM YYYY")}</Tag>
              </Text>
            </div>
            <Table
              rowKey={(r) => r.group.id}
              dataSource={finances}
              columns={columns}
              pagination={false}
              scroll={{ x: 1100 }}
              size="middle"
              sticky
              className="w-[100%]"
            />
          </Card>
        </motion.div>
      </Col>

      {/* Модалка создания/редактирования */}
      <Modal
        title={editing ? "Редактировать группу" : "Новая группа"}
        open={modalOpen}
        onOk={submit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? "Сохранить" : "Создать"}
        cancelText="Отмена"
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Название группы"
            name="name"
            rules={[{ required: true }]}
          >
            <Input placeholder="Например, Солнышко" />
          </Form.Item>
          <Form.Item
            label="Возрастная категория"
            name="ageRange"
            rules={[{ required: true }]}
          >
            <Input placeholder="3–4 года" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Ежемесячная плата за ребёнка" name="monthlyFee">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  addonAfter="сомони"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Фикс. месячные расходы"
                name="fixedMonthlyExpense"
                tooltip="Питание / материалы / доля от аренды и т.п. для этой группы"
              >
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  addonAfter="сомони"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Воспитатель" name="teacherId">
            <Select
              allowClear
              placeholder="Выберите воспитателя"
              options={staff
                .filter((s) => s.position === "Воспитатель")
                .map((s) => ({
                  value: s.id,
                  label: `${s.lastName} ${s.firstName}`,
                }))}
            />
          </Form.Item>
          <Form.Item label="Цвет" name="color">
            <Select
              options={COLORS.map((c) => ({
                value: c,
                label: (
                  <Space>
                    <span
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: c,
                      }}
                    />
                    {c}
                  </Space>
                ),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
