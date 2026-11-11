import { uiLanguage, uiText } from '../i18n/uiText'
import { useMemo, useState } from "react";
import {
  Alert,
  Card,
  Col,
  Row,
  Space,
  Tag,
  Typography,
  Statistic,
  Progress,
  Table,
  DatePicker,
} from "antd";
import {
  RiseOutlined,
  WalletOutlined,
  AlertOutlined,
  CrownOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Area, Column, Pie, Line } from "@ant-design/charts";
import { motion } from "framer-motion";
import dayjs from "dayjs";

import { TrendingUp, LineChart as LineChartIcon, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { SproutPageHeader, SproutEmpty } from "../components/sprout";
import StatCard from "../components/ui/StatCard";
import { useDataStore } from "../store/dataStore";
import { useLabels } from "../hooks/useLabels";
import { cap } from "../lib/labels";
import { calcGlobalFinance, calcGroupFinances } from "../lib/finance";
import { formatMoney, formatMoneyCompact, formatPercent } from "../lib/format";
import { useChartTheme } from '../theme/chartTheme'

const { Text, Title } = Typography;

export default function AnalyticsPage() {
  const chartTheme = useChartTheme()
  const L = useLabels();
  const isSchool = L.isSchool;
  const groups = useDataStore((s) => s.groups);
  const children = useDataStore((s) => s.children);
  const payments = useDataStore((s) => s.payments);
  const expenses = useDataStore((s) => s.expenses);
  const extraIncome = useDataStore((s) => s.extraIncome);
  const attendance = useDataStore((s) => s.attendance);

  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));

  // Текущий месяц
  const groupFin = useMemo(
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
    [groups, children, payments, expenses, extraIncome, attendance, month, uiLanguage()],
  );
  const global = useMemo(
    () => calcGlobalFinance(groupFin, expenses, month),
    [groupFin, expenses, month, uiLanguage()],
  );

  // 12-месячный тренд
  const yearTrend = useMemo(() => {
    const arr: {
      month: string;
      income: number;
      expenses: number;
      profit: number;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = dayjs().subtract(i, "month").format("YYYY-MM");
      const gf = calcGroupFinances({
        groups,
        children,
        payments,
        expenses,
        extraIncome,
        attendance,
        month: m,
      });
      const g = calcGlobalFinance(gf, expenses, m);
      arr.push({
        month: dayjs(m + "-01").format("MMM YY"),
        income: g.totalIncome,
        expenses: g.totalExpenses,
        profit: g.netProfit,
      });
    }
    return arr;
  }, [groups, children, payments, expenses, extraIncome, attendance, uiLanguage()]);

  // Серии для area-чарта дохода/расхода
  const trendSeries = yearTrend.flatMap((p) => [
    { month: p.month, type: uiText("Доход"), value: p.income },
    { month: p.month, type: uiText("Расход"), value: p.expenses },
  ]);

  // Тренд прибыли — отдельная линия (определяем рост/спад)
  const profitTrend = yearTrend.map((p) => ({
    month: p.month,
    value: p.profit,
  }));
  const lastTwo = yearTrend.slice(-2);
  const profitGrowing =
    lastTwo.length === 2 ? lastTwo[1].profit >= lastTwo[0].profit : true;
  const growthPct =
    lastTwo.length === 2 && lastTwo[0].profit !== 0
      ? ((lastTwo[1].profit - lastTwo[0].profit) /
          Math.abs(lastTwo[0].profit)) *
        100
      : 0;

  // ROI = чистая прибыль / расходы * 100%
  const roi =
    global.totalExpenses > 0 ? global.netProfit / global.totalExpenses : 0;

  // Cash flow (приток - отток) по 6 месяцам
  const cashFlow = yearTrend
    .slice(-6)
    .map((p) => ({
      month: p.month,
      type: uiText("Приток"),
      value: p.income,
    }))
    .concat(
      yearTrend.slice(-6).map((p) => ({
        month: p.month,
        type: uiText("Отток"),
        value: -p.expenses,
      })),
    );

  // Есть ли реальные данные для графиков (yearTrend всегда 12 точек, но могут быть нули)
  const hasTrendData = yearTrend.some((p) => p.income > 0 || p.expenses > 0)
  const hasProfitData = yearTrend.some((p) => p.profit !== 0)
  const hasCashFlowData = yearTrend.slice(-6).some((p) => p.income > 0 || p.expenses > 0)

  // Доля категорий в расходах
  const expenseShare = (() => {
    const map = new Map<string, number>();
    expenses
      .filter((e) => e.month === month)
      .forEach((e) =>
        map.set(e.category, (map.get(e.category) || 0) + e.amount),
      );
    return Array.from(map.entries()).map(([type, value]) => ({ type: uiText(type), value }));
  })();

  // Самые прибыльные / убыточные группы
  const sortedByProfit = [...groupFin].sort((a, b) => b.profit - a.profit);

  // Понятное объяснение «человеческим языком» — что значат цифры
  const plainSummary = (() => {
    const inc = Math.round(global.totalIncome)
    const exp = Math.round(global.totalExpenses)
    const net = Math.round(global.netProfit)
    const monthName = dayjs(month + '-01').format('MMMM YYYY')
    if (inc === 0 && exp === 0) {
      return uiText("За {0} пока нет ни доходов, ни расходов. Как только появятся оплаты и расходы — здесь будет видно, в плюсе учреждение или в минусе.", monthName)
    }
    if (net >= 0) {
      return uiText("За {0} учреждение получило {1} и потратило {2}. Осталось «в кармане» {3} — значит работаете в плюс. 👍", monthName, formatMoney(inc), formatMoney(exp), formatMoney(net))
    }
    return uiText("За {0} учреждение получило {1}, но потратило больше — {2}. Не хватило {3} — значит сейчас работаете в минус. Стоит снизить расходы или поднять оплату/набор. ⚠️", monthName, formatMoney(inc), formatMoney(exp), formatMoney(Math.abs(net)))
  })();

  return (
    <div>
      <SproutPageHeader
        title={uiText("Аналитика")}
        icon={<TrendingUp size={22} strokeWidth={2} />}
        iconAccent="cyan"
        description={uiText("Простыми словами: сколько заработали, сколько потратили и осталось ли в плюсе")}
        actions={
          <DatePicker
            picker="month"
            value={dayjs(month + "-01")}
            onChange={(d) => d && setMonth(d.format("YYYY-MM"))}
            allowClear={false}
          />
        }
      />

      {/* Объяснение человеческим языком */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card
          bordered={false}
          style={{
            marginBottom: 16,
            background: global.netProfit >= 0 ? 'var(--sp-primary-ghost)' : 'var(--sp-rose-soft)',
            borderRadius: 14,
          }}
          bodyStyle={{ padding: 16 }}
        >
          <Space align="start" size={12}>
            <span style={{ fontSize: 22 }}>
              {global.totalIncome === 0 && global.totalExpenses === 0
                ? '📊'
                : global.netProfit >= 0
                  ? '✅'
                  : '⚠️'}
            </span>
            <Text style={{ fontSize: 15, lineHeight: 1.5 }}>{plainSummary}</Text>
          </Space>
        </Card>
      </motion.div>

      {/* Главная сводка с авто-выводом */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Alert
          type={global.isProfitable ? "success" : "error"}
          showIcon
          icon={global.isProfitable ? <CrownOutlined /> : <AlertOutlined />}
          message={
            <Space>
              {global.isProfitable ? (
                <Text strong>{uiText("Компания прибыльная")}</Text>
              ) : (
                <Text strong>{uiText("Компания убыточная")}</Text>
              )}
              <Tag color={profitGrowing ? "green" : "red"}>
                {profitGrowing ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{" "}
                {" " + uiText("Прибыль") + " "}{profitGrowing ? uiText("растёт") : uiText("падает")} (
                {isFinite(growthPct)
                  ? Math.max(-999, Math.min(999, growthPct)).toFixed(1)
                  : "0.0"}
                {" " + uiText("% за месяц)") + " "}</Tag>
            </Space>
          }
          description={
            <span>
              {" " + uiText("Доход:")}{" "}
              <Text strong>{formatMoneyCompact(global.totalIncome)}</Text> {" " + uiText("· Расходы:")}{" "}
              <Text strong>{formatMoneyCompact(global.totalExpenses)}</Text> {" " + uiText("· Чистая прибыль:")}{" "}
              <Text
                strong
                style={{ color: global.netProfit >= 0 ? "#0D7A7C" : "#E5533D" }}
              >
                {global.netProfit >= 0 ? "+" : ""}
                {formatMoneyCompact(global.netProfit)}
              </Text>{" "}
              {" " + uiText("· Маржа:") + " "}<Text strong>{formatPercent(global.margin)}</Text> · ROI:{" "}
              <Text strong>{formatPercent(roi)}</Text>
            </span>
          }
          style={{ marginBottom: 16 }}
        />
      </motion.div>

      {/* KPI */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard
            title={uiText("Доход всех классов")}
            value={global.totalIncome}
            format="money"
            variant="success"
            icon={<WalletOutlined />}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title={uiText("Расходы всего")}
            value={global.totalExpenses}
            format="money"
            variant="warning"
            icon={<RiseOutlined />}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title={uiText("Зарплаты")}
            value={global.salaries}
            format="money"
            variant="primary"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title={uiText("Налоги")}
            value={global.taxes}
            format="money"
            variant="danger"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4 ">
        <Col xs={24} lg={16}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>{uiText("Динамика дохода и расхода (12 месяцев)")}</Title>
              {hasTrendData ? (
                <Area
                  theme={chartTheme}
                  data={trendSeries}
                  xField="month"
                  yField="value"
                  seriesField="type"
                  //@ts-ignore
                  smooth
                  height={300}
                  color={["#0D7A7C", "#FFB020"]}
                  areaStyle={{ fillOpacity: 0.3 }}
                  legend={{ position: "top-right" }}
                  animation={{ appear: { animation: "wave-in", duration: 1100 } }}
                />
              ) : (
                <SproutEmpty
                  icon={<LineChartIcon size={28} strokeWidth={1.8} />}
                  title={uiText("Данных пока нет")}
                  description={uiText("Тренд появится после первого месяца с оплатами и расходами")}
                  minHeight={300}
                />
              )}
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>Profit / Loss</Title>
              {hasProfitData ? (
                <Line
                  theme={chartTheme}
                  data={profitTrend}
                  xField="month"
                  yField="value"
                  smooth
                  height={300}
                  color={profitGrowing ? "#0D7A7C" : "#C0392B"}
                  point={{ size: 4 }}
                  animation={{ appear: { animation: "path-in", duration: 1100 } }}
                />
              ) : (
                <SproutEmpty
                  icon={<TrendingUp size={28} strokeWidth={1.8} />}
                  title={uiText("Прибыли пока нет")}
                  description={uiText("График появится после первых операций")}
                  minHeight={300}
                />
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>{uiText("Cash flow (6 мес.)")}</Title>
              {hasCashFlowData ? (
                <Column
                  theme={chartTheme}
                  data={cashFlow}
                  xField="month"
                  yField="value"
                  seriesField="type"
                  isGroup
                  height={280}
                  color={["#0D7A7C", "#C0392B"]}
                  columnStyle={{ radius: [8, 8, 0, 0] }}
                  legend={{ position: "top-right" }}
                />
              ) : (
                <SproutEmpty
                  icon={<BarChart3 size={28} strokeWidth={1.8} />}
                  title={uiText("Cash flow пустой")}
                  description={uiText("Появится после первых притоков/оттоков")}
                  minHeight={280}
                />
              )}
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>{uiText("Структура расходов")}</Title>
              {expenseShare.length > 0 ? (
                <Pie
                  theme={chartTheme}
                  data={expenseShare}
                  angleField="value"
                  colorField="type"
                  radius={0.9}
                  innerRadius={0.55}
                  height={280}
                  legend={{ position: "bottom" }}
                  color={["#0D7A7C", "#3B8FBF", "#FFB020", "#8B7BD4", "#D9709B", "#1BA6A0"]}
                />
              ) : (
                <SproutEmpty
                  icon={<PieChartIcon size={28} strokeWidth={1.8} />}
                  title={uiText("Расходов в этом месяце нет")}
                  description={uiText("Добавьте первый расход на странице «Расходы»")}
                  minHeight={280}
                />
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>
                <ThunderboltOutlined /> {" " + uiText("Финансовая эффективность") + " "}</Title>
              <div className="mt-3">
                <Text type="secondary">{uiText("Маржа прибыли")}</Text>
                <Progress
                  percent={Math.max(0, Math.min(100, global.margin * 100))}
                  strokeColor={{ from: "#3B8FBF", to: "#0D7A7C" }}
                  format={() => formatPercent(global.margin)}
                />
                <Text type="secondary">ROI</Text>
                <Progress
                  percent={Math.max(0, Math.min(100, roi * 100))}
                  strokeColor={{ from: "#8B7BD4", to: "#D9709B" }}
                  format={() => formatPercent(roi)}
                />
                <Text type="secondary">
                  {" " + uiText("Привлечение детей (заполнено мест условно: 60 чел.)") + " "}</Text>
                <Progress
                  percent={Math.max(
                    0,
                    Math.min(100, (children.length / 60) * 100),
                  )}
                  strokeColor={{ from: "#1BA6A0", to: "#0D7A7C" }}
                  format={() => `${children.length} / 60`}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Statistic
                  title={uiText("Лучший класс")}
                  value={global.bestGroup?.group.name || "—"}
                  valueStyle={{
                    color: "#0D7A7C",
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                />
                <Statistic
                  title={uiText("Худший класс")}
                  value={global.worstGroup?.group.name || "—"}
                  valueStyle={{
                    color: "#E5533D",
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                />
              </div>
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
              <Title level={5}>{L.groups}{uiText(": рейтинг прибыли")}</Title>
              <Table
                rowKey={(r) => r.group.id}
                dataSource={sortedByProfit}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: "#",
                    key: "rk",
                    width: 40,
                    render: (_, __, idx) => (
                      <Tag
                        color={
                          idx === 0 ? "gold" : idx === 1 ? "silver" : "default"
                        }
                      >
                        {idx + 1}
                      </Tag>
                    ),
                  },
                  {
                    title: cap(L.group),
                    key: "name",
                    render: (_, r) => <Text strong>{r.group.name}</Text>,
                  },
                  {
                    title: uiText("Доход"),
                    dataIndex: "income",
                    render: (v: number) => formatMoney(v),
                  },
                  {
                    title: uiText("Прибыль"),
                    dataIndex: "profit",
                    render: (v: number) => (
                      <Tag color={v >= 0 ? "green" : "red"}>
                        {v >= 0 ? "+" : ""}
                        {formatMoney(v)}
                      </Tag>
                    ),
                  },
                ]}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  );
}
