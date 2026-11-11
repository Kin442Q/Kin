import { Alert, Card, Empty, Skeleton, Table, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Activity, BookOpenCheck, GraduationCap, School, Stethoscope, Target, UserRound, Users } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'

import { uiText } from '../../i18n/uiText'
import { useT } from '../../i18n'
import { SP, SproutKPI, SproutPageHeader } from '../../components/sprout'
import { ministryApi, type MinistryOverview } from '../../api/ministryApi'
import { HeatCell, MinistryFilterBar, num, pct, placeName, useMinistryFilters, useMinistryQuery } from './shared'

type RegionRow = MinistryOverview['regions'][number]

/** Сводка: итоги по выборке, срез по областям, школы, которым нужно внимание. */
export default function MinistryOverviewPage() {
  useT()
  const state = useMinistryQuery()
  const { query, period } = state
  const filters = useMinistryFilters()
  const overview = useQuery({ queryKey: ['ministry', 'overview', query], queryFn: () => ministryApi.overview(query) })

  const data = overview.data
  const t = data?.total

  const columns: ColumnsType<RegionRow> = [
    { title: uiText('Область'), key: 'region', render: (_, r) => placeName(r.region), sorter: (a, b) => placeName(a.region).localeCompare(placeName(b.region)) },
    { title: uiText('Школ'), dataIndex: 'schools', align: 'right', sorter: (a, b) => a.schools - b.schools },
    { title: uiText('Учеников'), dataIndex: 'students', align: 'right', sorter: (a, b) => a.students - b.students, render: (v: number) => v.toLocaleString('ru-RU') },
    { title: uiText('Учеников на учителя'), dataIndex: 'studentsPerTeacher', align: 'right', render: (v: number | null) => num(v), sorter: (a, b) => (a.studentsPerTeacher ?? 0) - (b.studentsPerTeacher ?? 0) },
    { title: uiText('Средний балл'), dataIndex: 'avgPercent', align: 'right', render: (v: number | null) => <HeatCell value={v} low={50} high={100} />, sorter: (a, b) => (a.avgPercent ?? -1) - (b.avgPercent ?? -1) },
    { title: uiText('Качество знаний'), dataIndex: 'quality', align: 'right', render: (v: number | null) => <HeatCell value={v} low={20} high={80} />, sorter: (a, b) => (a.quality ?? -1) - (b.quality ?? -1) },
    { title: uiText('Успеваемость'), dataIndex: 'success', align: 'right', render: (v: number | null) => <HeatCell value={v} low={70} high={100} />, sorter: (a, b) => (a.success ?? -1) - (b.success ?? -1) },
    { title: uiText('Посещаемость'), dataIndex: 'attendanceRate', align: 'right', render: (v: number | null) => <HeatCell value={v} low={70} high={100} />, sorter: (a, b) => (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1) },
  ]

  return (
    <div>
      <SproutPageHeader
        title={uiText('Сводка по школам')}
        description={uiText('Период: {0} — {1}. Средний балл приведён к 100 % шкалы школы, поэтому школы с пяти- и десятибалльной системой сопоставимы.', period.from, period.to)}
        icon={<School size={22} />}
        iconAccent="blue"
      />
      <MinistryFilterBar state={state} />

      {overview.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={uiText('Не удалось загрузить сводку. Попробуйте обновить страницу.')} />}

      {overview.isLoading || !t ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : t.schools === 0 ? (
        <Card>
          <Empty
            description={
              filters.data?.allSchools === false
                ? uiText('В вашем охвате пока нет действующих школ.')
                : uiText('Школ по выбранному фильтру нет.')
            }
          />
        </Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
            <SproutKPI label={uiText('Школ')} value={t.schools.toLocaleString('ru-RU')} hint={uiText('классов: {0}', t.classes)} icon={<School size={18} />} accent="blue" />
            <SproutKPI label={uiText('Учеников')} value={t.students.toLocaleString('ru-RU')} icon={<Users size={18} />} accent="mint" />
            <SproutKPI label={uiText('Учителей')} value={t.teachers.toLocaleString('ru-RU')} icon={<UserRound size={18} />} accent="lilac" />
            <SproutKPI label={uiText('Учеников на учителя')} value={num(t.studentsPerTeacher)} hint={uiText('чем выше, тем больше нагрузка')} icon={<Activity size={18} />} accent="yellow" />
            <SproutKPI label={uiText('Средний балл')} value={pct(t.avgPercent)} hint={uiText('оценок: {0}', t.gradesCount.toLocaleString('ru-RU'))} icon={<GraduationCap size={18} />} accent="mint" />
            <SproutKPI label={uiText('Качество знаний')} value={pct(t.quality)} hint={uiText('доля оценок «4» и «5»')} icon={<Target size={18} />} accent="cyan" />
            <SproutKPI label={uiText('Успеваемость')} value={pct(t.success)} hint={uiText('доля оценок не ниже «3»')} icon={<BookOpenCheck size={18} />} accent="blue" />
            <SproutKPI label={uiText('Посещаемость')} value={pct(t.attendanceRate)} hint={uiText('болеют: {0}', pct(t.illnessRate))} icon={<Stethoscope size={18} />} accent="rose" />
          </div>

          {data && (data.noData.grades > 0 || data.noData.attendance > 0 || data.noData.teachers > 0) && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={uiText('Данные заполнены не везде')}
              description={uiText(
                'Без оценок за период: {0} из {3} школ, без отметок посещаемости: {1}, без учителей в системе: {2}. Такие школы не попадают в средние показатели — пустой журнал не считается плохой успеваемостью.',
                data.noData.grades,
                data.noData.attendance,
                data.noData.teachers,
                t.schools,
              )}
            />
          )}

          <Card title={uiText('По областям')} style={{ marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
            <Table<RegionRow>
              size="middle"
              rowKey={(r) => r.region?.id ?? 'none'}
              columns={columns}
              dataSource={data?.regions ?? []}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>

          <Card title={uiText('Школы, которым нужно внимание')}>
            {data && data.attention.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {data.attention.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: SP.text }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: SP.muted }}>{[placeName(s.region), placeName(s.district)].join(' · ')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Tag color="red">{uiText('Средний балл')}: {pct(s.avgPercent)}</Tag>
                      <Tag>{uiText('Качество знаний')}: {pct(s.quality)}</Tag>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiText('За период нет школ с оценками.')} />
            )}
          </Card>
        </>
      )}
    </div>
  )
}
