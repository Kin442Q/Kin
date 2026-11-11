import { uiLanguage, uiText } from '../i18n/uiText'
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  App as AntdApp,
  Avatar,
  Tooltip,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  CheckOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloseOutlined,
  SendOutlined,
  WarningOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import dayjs from "dayjs";

import { Wallet } from "lucide-react";
import { SproutPageHeader } from "../components/sprout";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import StatCard from "../components/ui/StatCard";
import { formatMoney } from "../lib/format";
import { http } from "../api";
import { chatApi } from "../api/chatApi";

interface PaymentApi {
  id: string;
  studentId: string;
  month: string;
  amount: number | string;
  paid: boolean;
  paidAt: string | null;
  method: "CASH" | "CARD" | "TRANSFER" | null;
  comment: string | null;
  createdAt: string;
}

const { Text } = Typography;
const { useBreakpoint } = Grid;

export default function PaymentsPage() {
  const { message } = AntdApp.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const groups = useDataStore((s) => s.groups);
  const childrenAll = useDataStore((s) => s.children);
  const user = useAuthStore((s) => s.user);

  // Платежи теперь приходят с бекенда (по месяцу)
  const [payments, setPayments] = useState<PaymentApi[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [groupFilter, setGroupFilter] = useState<string | undefined>(
    user?.role === "TEACHER" ? user.groupId : undefined,
  );
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadPayments = async (m: string) => {
    try {
      setPaymentsLoading(true);
      const res = await http.get<PaymentApi[]>("/v1/payments", {
        params: { month: m },
      });
      setPayments(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось загрузить платежи");
      message.error(msg);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  const [remindersModalOpen, setRemindersModalOpen] = useState(false);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersResult, setRemindersResult] = useState<{
    totalOverdue: number;
    remindersSent: number;
    skipped: number;
    daysLeft: number;
    results: Array<{
      studentId: string;
      studentName: string;
      sent: number;
      skipped: boolean;
      reason?: string;
    }>;
  } | null>(null);

  const children = useMemo(() => {
    let res = childrenAll;
    if (user?.role === "TEACHER")
      res = res.filter((c) => c.groupId === user.groupId);
    return res;
  }, [childrenAll, user, uiLanguage()]);

  // Платёж для каждого ребёнка в выбранный месяц. Если платежа нет — создаём виртуальный «не оплачено».
  const rows = useMemo(() => {
    const list = children
      .filter((c) => !groupFilter || c.groupId === groupFilter)
      .map((c) => {
        const p = payments?.find(
          (x) => x.studentId === c.id && x.month === month,
        );
        const group = groups.find((g) => g.id === c.groupId);
        const rawAmount = p?.amount ?? c.monthlyFee ?? group?.monthlyFee ?? 0;
        return {
          key: c.id + "-" + month,
          child: c,
          group,
          payment: p,
          amount: Number(rawAmount) || 0,
          paid: p?.paid ?? false,
        };
      });
    return list.filter((r) =>
      !search.trim()
        ? true
        : (r.child.firstName + " " + r.child.lastName)
            .toLowerCase()
            .includes(search.toLowerCase()),
    );
  }, [children, payments, groups, month, groupFilter, search, uiLanguage()]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
    const debt = rows.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);
    return {
      paid,
      debt,
      paidCount: rows.filter((r) => r.paid).length,
      debtCount: rows.filter((r) => !r.paid).length,
    };
  }, [rows, uiLanguage()]);

  const togglePaid = async (row: (typeof rows)[number]) => {
    try {
      const newPaid = !row.paid;
      // Берём актуальный fee из ребёнка / группы прямо на момент клика,
      // а не из устаревшего row.amount (мог быть 0 если строка отрендерилась
      // до того как frontend получил monthlyFee).
      const childNow =
        childrenAll.find((c) => c.id === row.child.id) ?? row.child;
      const groupNow =
        groups.find((g) => g.id === childNow.groupId) ?? row.group;
      const computedAmount =
        Number(row.payment?.amount ?? 0) ||
        Number(childNow.monthlyFee ?? 0) ||
        Number(groupNow?.monthlyFee ?? 0) ||
        0;

      await http.post("/v1/payments/upsert", {
        studentId: row.child.id,
        month,
        amount: computedAmount,
        paid: newPaid,
        method: row.payment?.method ?? "CASH",
      });
      if (newPaid && computedAmount === 0) {
        message.warning(
          uiText("Сохранено, но плата не задана — укажите Индивидуальную плату или Ежемесячную плату группы"),
        );
      } else {
        message.success(newPaid ? uiText("Помечено как оплачено") : uiText("Помечено как долг"));
      }
      await loadPayments(month);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось сохранить платёж");
      message.error(msg);
    }
  };


  const [chatRemindId, setChatRemindId] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  // Напоминание об оплате прямо в чат (канал «Администрация», учитель его не видит)
  const remindInChat = async (row: (typeof rows)[number]) => {
    try {
      setChatRemindId(row.child.id);
      const res = await chatApi.paymentReminder(row.child.id, month, row.amount);
      if (res.sent > 0) {
        message.success(
          uiText("Напоминание отправлено в чат ({0} родител{1})", res.sent, res.sent === 1 ? "ю" : "ям"),
        );
      } else {
        message.warning(uiText("Нет родителей с аккаунтом для чата"));
      }
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || uiText("Не удалось отправить в чат"),
      );
    } finally {
      setChatRemindId(null);
    }
  };

  const removePayment = async (id: string) => {
    try {
      await http.delete(`/v1/payments/${id}`);
      message.success(uiText("Платёж удалён"));
      await loadPayments(month);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось удалить платёж");
      message.error(msg);
    }
  };

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      month: dayjs(month + "-01"),
      method: "cash",
    });
    setModalOpen(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const targetMonth = dayjs(values.month).format("YYYY-MM");
      const methodApi =
        (values.method as string)?.toUpperCase() === "CARD"
          ? "CARD"
          : (values.method as string)?.toUpperCase() === "TRANSFER"
            ? "TRANSFER"
            : "CASH";
      await http.post("/v1/payments/upsert", {
        studentId: values.childId,
        month: targetMonth,
        amount: Number(values.amount),
        paid: true,
        method: methodApi,
        comment: values.comment || undefined,
      });
      setModalOpen(false);
      message.success(uiText("Платёж зарегистрирован"));
      if (targetMonth === month) {
        await loadPayments(month);
      } else {
        setMonth(targetMonth);
      }
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось сохранить платёж");
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };
  const formatMoney = (value: number) =>
    new Intl.NumberFormat(uiLanguage() === 'en' ? 'en-US' : uiLanguage() === 'tg' ? 'tg-TJ' : 'ru-RU').format(Math.round(value));

  const getDaysLeftInMonth = (m: string) => {
    const [year, monthNum] = m.split("-").map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() + 1 === monthNum) {
      return Math.max(0, lastDay - today.getDate());
    }
    return 0;
  };

  const sendReminders = async () => {
    try {
      setRemindersLoading(true);

      const debtors = rows.filter((r) => !r.paid);
      const monthLabel = dayjs(month + "-01").format("MMMM YYYY");
      const daysLeft = getDaysLeftInMonth(month);

      const withPhones = debtors.filter((r) => {
        const phones = [r.child.motherPhone, r.child.fatherPhone].filter(
          Boolean,
        );
        return phones.length > 0;
      });
      const withoutPhones = debtors.filter((r) => {
        const phones = [r.child.motherPhone, r.child.fatherPhone].filter(
          Boolean,
        );
        return phones.length === 0;
      });

      const results: Array<{
        studentId: string;
        studentName: string;
        sent: number;
        skipped: boolean;
        reason?: string;
      }> = [];
      let totalSent = 0;
      let totalSkipped = withoutPhones.length;

      if (withPhones.length > 0) {
        const items = withPhones.map((r) => ({
          phones: [r.child.motherPhone, r.child.fatherPhone].filter(
            Boolean,
          ) as string[],
          studentName: `${r.child.firstName} ${r.child.lastName}`,
          amount: r.amount,
          daysLeft,
          groupName: r.group?.name,
          month: monthLabel,
        }));

        const response = await http.post("/v1/telegram/send-reminders", {
          items,
        });

        const { familiesNotified, messagesQueued, skipped } =
          response.data || {};

        totalSent = messagesQueued || 0;

        const skippedNames = new Set(
          (skipped || []).map((s: any) => s.studentName),
        );

        withPhones.forEach((r) => {
          const name = `${r.child.firstName} ${r.child.lastName}`;
          if (skippedNames.has(name)) {
            totalSkipped++;
            results.push({
              studentId: r.child.id,
              studentName: name,
              sent: 0,
              skipped: true,
              reason: uiText("Родители не зарегистрированы в боте"),
            });
          } else {
            results.push({
              studentId: r.child.id,
              studentName: name,
              sent: 1,
              skipped: false,
            });
          }
        });

        if (typeof familiesNotified === "number" && totalSent === 0) {
          totalSent = familiesNotified;
        }
      }

      withoutPhones.forEach((r) => {
        results.push({
          studentId: r.child.id,
          studentName: `${r.child.firstName} ${r.child.lastName}`,
          sent: 0,
          skipped: true,
          reason: uiText("Нет телефона родителей"),
        });
      });

      const resultData = {
        totalOverdue: debtors.length,
        remindersSent: totalSent,
        skipped: totalSkipped,
        daysLeft,
        results,
      };

      setRemindersResult(resultData);

      if (totalSent > 0) {
        message.success(
          uiText("Отправлено {0} напоминаний из {1} должников", totalSent, debtors.length),
        );
      } else if (debtors.length === 0) {
        message.info(uiText("Должников не найдено за этот месяц"));
      } else {
        message.warning(
          uiText("Найдено {0} должников, но никому не отправлено", debtors.length),
        );
      }
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        uiText("Ошибка отправки напоминаний");
      message.error(errorMsg);
    } finally {
      setRemindersLoading(false);
    }
  };

  return (
    <div>
      <SproutPageHeader
        title={uiText("Оплата")}
        icon={<Wallet size={22} strokeWidth={2} />}
        iconAccent="rose"
        description={uiText("Платежи за {0}", dayjs(month + "-01").format("MMMM YYYY"))}
        actions={
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(month + "-01")}
              onChange={(d) => d && setMonth(d.format("YYYY-MM"))}
              allowClear={false}
            />
            {user?.role !== "TEACHER" && totals.debtCount > 0 && (
              <Tooltip title={uiText("Отправить Telegram напоминания всем должникам")}>
                <Button
                  icon={<SendOutlined />}
                  onClick={() => setRemindersModalOpen(true)}
                  danger
                >
                  {isMobile
                    ? uiText("Напомнить ({0})", totals.debtCount)
                    : uiText("Напомнить должникам ({0})", totals.debtCount)}
                </Button>
              </Tooltip>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {isMobile ? uiText("Платёж") : uiText("Записать платёж")}
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard
            title={uiText("Оплатили")}
            value={formatMoney(totals.paidCount)}
            variant="success"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title={uiText("Должники")}
            value={formatMoney(totals.debtCount)}
            variant="danger"
          />
        </Col>
        {/* <Col xs={12} md={6}>
          <StatCard
            title="Поступило"
            value={formatMoney(totals.paid)}
            suffix=" сомони"
            variant="primary"
          />
        </Col> */}
        <Col xs={12} md={6}>
          <StatCard
            title={uiText("Ожидается")}
            value={formatMoney(totals.debt)}
            suffix={uiText("сомони")}
            variant="warning"
          />
        </Col>
      </Row>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4"
      >
        <Card className="glass" bordered={false}>
          <Row gutter={[12, 12]} className="mb-3">
            <Col xs={24} md={10}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={uiText("Поиск по ребёнку")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                allowClear
                style={{ width: "100%" }}
                placeholder={uiText("Все группы")}
                value={groupFilter}
                onChange={setGroupFilter}
                disabled={user?.role === "TEACHER"}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Col>
          </Row>

          {isMobile ? (
            <div className="flex flex-col gap-3">
              {rows.length === 0 && (
                <div className="text-center py-6 text-muted">
                  <Text type="secondary">{uiText("Нет записей")}</Text>
                </div>
              )}
              {rows.map((r) => (
                <Card
                  key={r.key}
                  size="small"
                  style={{
                    borderRadius: 12,
                    borderLeft: `4px solid ${r.paid ? "#0D7A7C" : "#E5533D"}`,
                  }}
                  styles={{ body: { padding: 12 } }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar
                      size={40}
                      style={{ background: r.group?.color || "#3B8FBF" }}
                    >
                      {r.child.firstName[0]}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.child.lastName} {r.child.firstName}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.group?.name || "—"}
                      </Text>
                    </div>
                    {r.paid ? (
                      <Tag
                        color="green"
                        icon={<CheckOutlined />}
                        style={{ margin: 0 }}
                      >
                        {" " + uiText("Оплачено") + " "}</Tag>
                    ) : (
                      <Tag
                        color="volcano"
                        icon={<CloseOutlined />}
                        style={{ margin: 0 }}
                      >
                        {" " + uiText("Долг") + " "}</Tag>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 mb-3">
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {" " + uiText("Сумма") + " "}</Text>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {formatMoney(r.amount)}{" "}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {" " + uiText("сомони") + " "}</Text>
                      </div>
                    </div>
                    {r.payment?.method && (
                      <Tag style={{ margin: 0 }}>{r.payment.method}</Tag>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      block
                      size="middle"
                      type={r.paid ? "default" : "primary"}
                      icon={r.paid ? <CloseOutlined /> : <CheckOutlined />}
                      onClick={() => togglePaid(r)}
                    >
                      {r.paid ? uiText("Снять оплату") : uiText("Отметить оплачено")}
                    </Button>
                    {isAdmin && !r.paid && (
                      <Button
                        size="middle"
                        icon={<MessageOutlined />}
                        loading={chatRemindId === r.child.id}
                        onClick={() => remindInChat(r)}
                      />
                    )}
                    {r.payment && (
                      <Popconfirm
                        title={uiText("Удалить запись?")}
                        okText={uiText("Да")}
                        cancelText={uiText("Нет")}
                        onConfirm={() => removePayment(r.payment!.id)}
                      >
                        <Button
                          size="middle"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Table
              rowKey="key"
              loading={paymentsLoading}
              dataSource={rows}
              scroll={{ x: 700 }}
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: uiText("Ребёнок"),
                  key: "child",
                  render: (_, r) => (
                    <Space>
                      <Avatar
                        size={32}
                        style={{ background: r.group?.color || "#3B8FBF" }}
                      >
                        {r.child.firstName[0]}
                      </Avatar>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {r.child.lastName} {r.child.firstName}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {r.group?.name}
                        </Text>
                      </div>
                    </Space>
                  ),
                },
                {
                  title: uiText("Сумма"),
                  key: "amount",
                  render: (_, r) => formatMoney(r.amount),
                },
                {
                  title: uiText("Статус"),
                  key: "status",
                  filters: [
                    { text: uiText("Оплачено"), value: "paid" },
                    { text: uiText("Должник"), value: "debt" },
                  ],
                  onFilter: (v, r) => (v === "paid" ? r.paid : !r.paid),
                  render: (_, r) =>
                    r.paid ? (
                      <Tag color="green" icon={<CheckOutlined />}>
                        {" " + uiText("Оплачено") + " "}{r.payment?.paidAt
                          ? ` · ${dayjs(r.payment.paidAt).format("DD.MM")}`
                          : ""}
                      </Tag>
                    ) : (
                      <Tag color="volcano" icon={<CloseOutlined />}>
                        {" " + uiText("Долг") + " "}</Tag>
                    ),
                },
                {
                  title: uiText("Способ"),
                  key: "method",
                  render: (_, r) =>
                    r.payment?.method ? <Tag>{r.payment.method}</Tag> : "—",
                },
                {
                  title: uiText("Действия"),
                  key: "actions",
                  render: (_, r) => (
                    <Space>
                      <Tooltip
                        title={r.paid ? uiText("Снять оплату") : uiText("Отметить оплачено")}
                      >
                        <Button
                          size="small"
                          type={r.paid ? "default" : "primary"}
                          icon={r.paid ? <CloseOutlined /> : <CheckOutlined />}
                          onClick={() => togglePaid(r)}
                        >
                          {r.paid ? uiText("Долг") : uiText("Оплачено")}
                        </Button>
                      </Tooltip>
                      {isAdmin && !r.paid && (
                        <Tooltip title={uiText("Напомнить об оплате в чате")}>
                          <Button
                            size="small"
                            icon={<MessageOutlined />}
                            loading={chatRemindId === r.child.id}
                            onClick={() => remindInChat(r)}
                          />
                        </Tooltip>
                      )}
                      {r.payment && (
                        <Popconfirm
                          title={uiText("Удалить запись?")}
                          okText={uiText("Да")}
                          cancelText={uiText("Нет")}
                          onConfirm={() => removePayment(r.payment!.id)}
                        >
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </motion.div>

      <Modal
        title={uiText("Регистрация платежа")}
        open={modalOpen}
        onOk={submit}
        onCancel={() => setModalOpen(false)}
        okText={uiText("Сохранить")}
        cancelText={uiText("Отмена")}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="childId"
            label={uiText("Ребёнок")}
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={childrenAll.map((c) => ({
                value: c.id,
                label: `${c.lastName} ${c.firstName} · ${groups.find((g) => g.id === c.groupId)?.name || "—"}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="month" label={uiText("Месяц")} rules={[{ required: true }]}>
            <DatePicker picker="month" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="amount" label={uiText("Сумма")} rules={[{ required: true }]}>
            <InputNumber
              style={{ width: "100%" }}
              addonAfter={uiText("сомони")}
              min={0}
            />
          </Form.Item>
          <Form.Item name="method" label={uiText("Способ оплаты")}>
            <Select
              options={[
                { value: "cash", label: uiText("Наличные") },
                { value: "card", label: uiText("Карта") },
                { value: "transfer", label: uiText("Перевод") },
              ]}
            />
          </Form.Item>
          <Form.Item name="comment" label={uiText("Комментарий")}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: "#3B8FBF" }} />
            <span>
              {remindersResult
                ? uiText("Результат отправки")
                : uiText("Отправить напоминания должникам")}
            </span>
          </Space>
        }
        open={remindersModalOpen}
        onCancel={() => {
          setRemindersModalOpen(false);
          setRemindersResult(null);
        }}
        footer={
          remindersResult ? (
            <Button
              type="primary"
              onClick={() => {
                setRemindersModalOpen(false);
                setRemindersResult(null);
              }}
            >
              {" " + uiText("Закрыть") + " "}</Button>
          ) : (
            <Space>
              <Button onClick={() => setRemindersModalOpen(false)}>
                {" " + uiText("Отмена") + " "}</Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={remindersLoading}
                onClick={sendReminders}
                danger
              >
                {" " + uiText("Отправить") + " "}</Button>
            </Space>
          )
        }
        width={isMobile ? "100%" : 600}
        destroyOnClose
      >
        {!remindersResult ? (
          <div>
            <Card
              className="mb-3"
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              <Space align="start">
                <WarningOutlined
                  style={{ color: "#E5533D", fontSize: 20, marginTop: 2 }}
                />
                <div>
                  <Text strong>
                    {" " + uiText("Будет отправлено") + " "}{totals.debtCount}{" "}
                    {totals.debtCount === 1 ? uiText("напоминание") : uiText("напоминаний")}
                  </Text>
                  <div>
                    <Text type="secondary">
                      {" " + uiText("За месяц:")}{" "}
                      <b>{dayjs(month + "-01").format("MMMM YYYY")}</b>
                    </Text>
                  </div>
                  <div>
                    <Text type="secondary">
                      {" " + uiText("Сумма долга:") + " "}<b>{formatMoney(totals.debt)} {" " + uiText("сомони")}</b>
                    </Text>
                  </div>
                </div>
              </Space>
            </Card>
            <Text type="secondary">
              {" " + uiText("💡 Напоминания будут отправлены только тем родителям, у которых привязан Telegram Chat ID.") + " "}</Text>
          </div>
        ) : (
          <div>
            <Row gutter={[12, 12]} className="mb-3">
              <Col span={8}>
                <Card
                  size="small"
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ fontSize: 28, fontWeight: 600, color: "#E5533D" }}
                  >
                    {remindersResult.totalOverdue}
                  </div>
                  <Text type="secondary">{uiText("Должников")}</Text>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  size="small"
                  style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ fontSize: 28, fontWeight: 600, color: "#0D7A7C" }}
                  >
                    {remindersResult.remindersSent}
                  </div>
                  <Text type="secondary">{uiText("Отправлено")}</Text>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  size="small"
                  style={{
                    background: "rgba(245, 158, 11, 0.08)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ fontSize: 28, fontWeight: 600, color: "#FFB020" }}
                  >
                    {remindersResult.skipped}
                  </div>
                  <Text type="secondary">{uiText("Без Telegram")}</Text>
                </Card>
              </Col>
            </Row>

            <Text strong>{uiText("Детали:")}</Text>
            <div
              style={{
                maxHeight: 300,
                overflowY: "auto",
                marginTop: 8,
                padding: 8,
                background: "rgba(0,0,0,0.02)",
                borderRadius: 8,
              }}
            >
              {remindersResult.results.map((r) => (
                <div
                  key={r.studentId}
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{r.studentName}</span>
                  {r.skipped ? (
                    <Tag color="orange">{r.reason}</Tag>
                  ) : (
                    <Tag color="green">{uiText("Отправлено:") + " "}{r.sent}</Tag>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
