import { lazy, Suspense, useState } from 'react'
import { Alert, Button, Card, Input, Segmented, Skeleton, Table, Tag, Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Download, School } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'

import { uiText } from '../../i18n/uiText'
import { useT } from '../../i18n'
import { SproutPageHeader } from '../../components/sprout'
import { exportRows } from '../../lib/exportXlsx'
import { ministryApi, type SchoolRow } from '../../api/ministryApi'
import { HeatCell, MinistryFilterBar, num, placeName, useMinistryQuery } from './shared'

// Карта тяжёлая (Leaflet): грузится только когда её открыли.
const SchoolsMap = lazy(() => import('./SchoolsMap'))

/** Школы охвата: рейтинг по среднему баллу, нагрузка, посещаемость и карта. */
export default function MinistrySchoolsPage() {
  useT()
  const state = useMinistryQuery()
  const { query, period } = state
  const [view, setView] = useState<'table' | 'map'>('table')
  const [search, setSearch] = useState('')

  const schools = useQuery({ queryKey: ['ministry', 'schools', query], queryFn: () => ministryApi.schools(query) })
  const all = schools.data?.schools ?? []
  const q = search.trim().toLowerCase()
  const rows = q ? all.filter((s) => s.name.toLowerCase().includes(q)) : all
  const withoutCoords = all.filter((s) => s.flags.noLocation).length

  const columns: ColumnsType<SchoolRow> = [
    {
      title: '#',
      dataIndex: 'rank',
      width: 56,
      render: (v: number | null) => v ?? '—',
      sorter: (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9),
      defaultSortOrder: 'ascend',
    },
    { title: uiText('Школа'), dataIndex: 'name', fixed: 'left', render: (v: string) => <strong>{v}</strong>, sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: uiText('Район или город'), key: 'district', render: (_, r) => [placeName(r.region), placeName(r.district)].join(' · '), sorter: (a, b) => placeName(a.district).localeCompare(placeName(b.district)) },
    { title: uiText('Учеников'), dataIndex: 'students', align: 'right', sorter: (a, b) => a.students - b.students },
    { title: uiText('Учителей'), dataIndex: 'teachers', align: 'right', sorter: (a, b) => a.teachers - b.teachers },
    { title: uiText('Учеников на учителя'), dataIndex: 'studentsPerTeacher', align: 'right', render: (v: number | null) => <HeatCell value={v} low={8} high={30} invert text={num(v)} />, sorter: (a, b) => (a.studentsPerTeacher ?? 0) - (b.studentsPerTeacher ?? 0) },
    { title: uiText('Средний балл'), dataIndex: 'avgPercent', align: 'right', render: (v: number | null) => <HeatCell value={v} low={50} high={100} />, sorter: (a, b) => (a.avgPercent ?? -1) - (b.avgPercent ?? -1) },
    { title: uiText('Качество знаний'), dataIndex: 'quality', align: 'right', render: (v: number | null) => <HeatCell value={v} low={20} high={80} />, sorter: (a, b) => (a.quality ?? -1) - (b.quality ?? -1) },
    { title: uiText('Успеваемость'), dataIndex: 'success', align: 'right', render: (v: number | null) => <HeatCell value={v} low={70} high={100} />, sorter: (a, b) => (a.success ?? -1) - (b.success ?? -1) },
    { title: uiText('Посещаемость'), dataIndex: 'attendanceRate', align: 'right', render: (v: number | null) => <HeatCell value={v} low={70} high={100} />, sorter: (a, b) => (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1) },
    {
      title: uiText('Данные'),
      key: 'flags',
      render: (_, r) => {
        const missing = [
          r.flags.noGrades && uiText('нет оценок'),
          r.flags.noAttendance && uiText('нет посещаемости'),
          r.flags.noTeachers && uiText('нет учителей'),
        ].filter(Boolean) as string[]
        return missing.length ? (
          <Tooltip title={uiText('Школа не заполнила: {0}', missing.join(', '))}>
            <Tag color="gold">{uiText('неполные')}</Tag>
          </Tooltip>
        ) : (
          <Tag color="green">{uiText('полные')}</Tag>
        )
      },
    },
  ]

  const download = () =>
    exportRows(
      'shkoly',
      rows.map((r) => ({
        '#': r.rank ?? '',
        [uiText('Школа')]: r.name,
        [uiText('Область')]: placeName(r.region),
        [uiText('Район или город')]: placeName(r.district),
        [uiText('Учеников')]: r.students,
        [uiText('Учителей')]: r.teachers,
        [uiText('Учеников на учителя')]: r.studentsPerTeacher ?? '',
        [uiText('Средний балл')]: r.avgPercent ?? '',
        [uiText('Качество знаний')]: r.quality ?? '',
        [uiText('Успеваемость')]: r.success ?? '',
        [uiText('Посещаемость')]: r.attendanceRate ?? '',
        [uiText('Болеют')]: r.illnessRate ?? '',
      })),
      uiText('Школы'),
    )

  return (
    <div>
      <SproutPageHeader
        title={uiText('Школы')}
        description={uiText('Период: {0} — {1}. Рейтинг строится по среднему баллу в процентах от шкалы школы; школы без оценок в рейтинг не попадают.', period.from, period.to)}
        icon={<School size={22} />}
        iconAccent="mint"
        chip={all.length ? uiText('школ: {0}', all.length) : undefined}
        actions={
          <Button icon={<Download size={16} />} onClick={download} disabled={!rows.length}>
            {uiText('Выгрузить в Excel')}
          </Button>
        }
      />
      <MinistryFilterBar state={state} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Input.Search allowClear placeholder={uiText('Найти школу по названию')} style={{ maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Segmented
          value={view}
          onChange={(v) => setView(v as 'table' | 'map')}
          options={[
            { value: 'table', label: uiText('Таблица') },
            { value: 'map', label: uiText('Карта') },
          ]}
        />
      </div>

      {schools.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={uiText('Не удалось загрузить школы. Попробуйте обновить страницу.')} />}

      {schools.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : view === 'map' ? (
        <>
          {withoutCoords > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={uiText('У {0} школ не указаны координаты — на карте их нет. Координаты школа задаёт в своих настройках.', withoutCoords)}
            />
          )}
          <Suspense fallback={<Skeleton active paragraph={{ rows: 10 }} />}>
            <SchoolsMap schools={rows} />
          </Suspense>
        </>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<SchoolRow>
            size="middle"
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 25, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}
    </div>
  )
}
