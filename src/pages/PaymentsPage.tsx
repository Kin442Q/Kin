import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
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
  WalletOutlined,
  PlusOutlined,
  CheckOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import dayjs from "dayjs";

import PageHeader from "../components/PageHeader";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import StatCard from "../components/ui/StatCard";
import { formatMoney } from "../lib/format";
import { uid } from "../lib/uid";
import type { Payment } from "../types";

const { Text } = Typography;

export default function PaymentsPage() {
  const { message } = AntdApp.useApp();
  const groups = useDataStore((s) => s.groups);
  const childrenAll = useDataStore((s) => s.children);
  const payments = useDataStore((s) => s.payments);
  const upsertPayment = useDataStore((s) => s.upsertPayment);
  const deletePayment = useDataStore((s) => s.deletePayment);
  const user = useAuthStore((s) => s.user);

  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [groupFilter, setGroupFilter] = useState<string | undefined>(
    user?.role === "teacher" ? user.groupId : undefined,
  );
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const children = useMemo(() => {
    let res = childrenAll;
    if (user?.role === "teacher")
      res = res.filter((c) => c.groupId === user.groupId);
    return res;
  }, [childrenAll, user]);

  // Платёж для каждого ребёнка в выбранный месяц. Если платежа нет — создаём виртуальный «не оплачено».
  const rows = useMemo(() => {
    const list = children
      .filter((c) => !groupFilter || c.groupId === groupFilter)
      .map((c) => {
        const p = payments.find((x) => x.childId === c.id && x.month === month);
        const group = groups.find((g) => g.id === c.groupId);
        return {
          key: c.id + "-" + month,
          child: c,
          group,
          payment: p,
          amount: p?.amount ?? c.monthlyFee ?? group?.monthlyFee ?? 0,
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
  }, [children, payments, groups, month, groupFilter, search]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
    const debt = rows.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);
    return {
      paid,
      debt,
      paidCount: rows.filter((r) => r.paid).length,
      debtCount: rows.filter((r) => !r.paid).length,
    };
  }, [rows]);

  const togglePaid = (row: (typeof rows)[number]) => {
    const data: Payment = {
      id: row.payment?.id ?? uid(),
      childId: row.child.id,
      month,
      amount: row.amount,
      paid: !row.paid,
      paidAt: !row.paid ? new Date().toISOString() : undefined,
      method: row.payment?.method,
      createdAt: row.payment?.createdAt ?? new Date().toISOString(),
    };
    upsertPayment(data);
    message.success(data.paid ? "Помечено как оплачено" : "Помечено как долг");
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
      const child = childrenAll.find((c) => c.id === values.childId);
      if (!child) return;
      const data: Payment = {
        id: uid(),
        childId: values.childId,
        month: dayjs(values.month).format("YYYY-MM"),
        amount: values.amount,
        paid: true,
        paidAt: new Date().toISOString(),
        method: values.method,
        comment: values.comment,
        createdAt: new Date().toISOString(),
      };
      upsertPayment(data);
      setModalOpen(false);
      message.success("Платёж зарегистрирован");
    } catch {
      /* validation */
    }
  };
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("ru-RU").format(Math.round(value));

  return (
    <div>
      <PageHeader
        title="Оплата"
        icon={<WalletOutlined />}
        description={`Платежи за ${dayjs(month + "-01").format("MMMM YYYY")}`}
        actions={
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(month + "-01")}
              onChange={(d) => d && setMonth(d.format("YYYY-MM"))}
              allowClear={false}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Записать платёж
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard
            title="Оплатили"
            value={formatMoney(totals.paidCount)}
            variant="success"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Должники"
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
            title="Ожидается"
            value={formatMoney(totals.debt)}
            suffix=" сомони"
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
                placeholder="Поиск по ребёнку"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                allowClear
                style={{ width: "100%" }}
                placeholder="Все группы"
                value={groupFilter}
                onChange={setGroupFilter}
                disabled={user?.role === "teacher"}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Col>
          </Row>

          <Table
            rowKey="key"
            dataSource={rows}
            scroll={{ x: 700 }}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: "Ребёнок",
                key: "child",
                render: (_, r) => (
                  <Space>
                    <Avatar
                      size={32}
                      style={{ background: r.group?.color || "#6366f1" }}
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
                title: "Сумма",
                key: "amount",
                render: (_, r) => formatMoney(r.amount),
              },
              {
                title: "Статус",
                key: "status",
                filters: [
                  { text: "Оплачено", value: "paid" },
                  { text: "Должник", value: "debt" },
                ],
                onFilter: (v, r) => (v === "paid" ? r.paid : !r.paid),
                render: (_, r) =>
                  r.paid ? (
                    <Tag color="green" icon={<CheckOutlined />}>
                      Оплачено
                      {r.payment?.paidAt
                        ? ` · ${dayjs(r.payment.paidAt).format("DD.MM")}`
                        : ""}
                    </Tag>
                  ) : (
                    <Tag color="volcano" icon={<CloseOutlined />}>
                      Долг
                    </Tag>
                  ),
              },
              {
                title: "Способ",
                key: "method",
                render: (_, r) =>
                  r.payment?.method ? <Tag>{r.payment.method}</Tag> : "—",
              },
              {
                title: "Действия",
                key: "actions",
                render: (_, r) => (
                  <Space>
                    <Tooltip
                      title={r.paid ? "Снять оплату" : "Отметить оплачено"}
                    >
                      <Button
                        size="small"
                        type={r.paid ? "default" : "primary"}
                        icon={r.paid ? <CloseOutlined /> : <CheckOutlined />}
                        onClick={() => togglePaid(r)}
                      >
                        {r.paid ? "Долг" : "Оплачено"}
                      </Button>
                    </Tooltip>
                    {r.payment && (
                      <Popconfirm
                        title="Удалить запись?"
                        okText="Да"
                        cancelText="Нет"
                        onConfirm={() => deletePayment(r.payment!.id)}
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
        </Card>
      </motion.div>

      <Modal
        title="Регистрация платежа"
        open={modalOpen}
        onOk={submit}
        onCancel={() => setModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="childId"
            label="Ребёнок"
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
          <Form.Item name="month" label="Месяц" rules={[{ required: true }]}>
            <DatePicker picker="month" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="amount" label="Сумма" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: "100%" }}
              addonAfter="сомони"
              min={0}
            />
          </Form.Item>
          <Form.Item name="method" label="Способ оплаты">
            <Select
              options={[
                { value: "cash", label: "Наличные" },
                { value: "card", label: "Карта" },
                { value: "transfer", label: "Перевод" },
              ]}
            />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
