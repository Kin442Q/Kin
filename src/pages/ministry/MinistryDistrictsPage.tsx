import { Alert, Button, Card, Skeleton, Table } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Download, MapPinned } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'

import { uiText } from '../../i18n/uiText'
import { useT } from '../../i18n'
import { SproutPageHeader } from '../../components/sprout'
import { exportRows } from '../../lib/exportXlsx'
import { ministryApi, type DistrictRow } from '../../api/ministryApi'
import { HeatCell, MinistryFilterBar, num, placeName, useMinistryQuery } from './shared'
import { TableTitle, helpColumns } from '../../components/TableHelp'
import { ministryHelp, ministryTables } from './help'

/** Сравнение районов и городов: одна строка на район, значения подсвечены от слабых к сильным. */
export default function MinistryDistrictsPage() {
  useT()
  const state = useMinistryQuery()
  const { query, period } = state
  const districts = useQuery({ queryKey: ['ministry', 'districts', query], queryFn: () => ministryApi.districts(query) })
  const rows = districts.data?.districts ?? []

  const columns: ColumnsType<DistrictRow> = [
    { title: uiText('Район или город'), key: 'district', fixed: 'left', render: (_, r) => <strong>{placeName(r.district)}</strong>, sorter: (a, b) => placeName(a.district).localeCompare(placeName(b.district)) },
    { title: uiText('Область'), key: 'region', render: (_, r) => placeName(r.region), sorter: (a, b) => placeName(a.region).localeCompare(placeName(b.region)) },
    { title: uiText('Школ'), dataIndex: 'schools', align: 'right', sorter: (a, b) => a.schools - b.schools },
    { title: uiText('Учеников'), dataIndex: 'students', align: 'right', render: (v: number) => v.toLocaleString('ru-RU'), sorter: (a, b) => a.students - b.students },
    { title: uiText('Учителей'), dataIndex: 'teachers', align: 'right', sorter: (a, b) => a.teachers - b.teachers },
    { title: uiText('Учеников на учителя'), dataIndex: 'studentsPerTeacher', align: 'right', render: (v: number | null) => <HeatCell value={v} low={8} high={30} invert text={num(v)} />, sorter: (a, b) => (a.studentsPerTeacher ?? 0) - (b.studentsPerTeacher ?? 0) },
    { title: uiText('Средний балл'), dataIndex: 'avgPercent', align: 'right', defaultSortOrder: 'descend', render: (v: number | null) => <HeatCell value={v} low={50} high={100} />, sorter: (a, b) => (a.avgPercent ?? -1) - (b.avgPercent ?? -1) },
    { title: uiText('Качество знаний'), dataIndex: 'quality', align: 'right', render: (v: number | null) => <HeatCell value={v} low={20} high={80} />, sorter: (a, b) => (a.quality ?? -1) - (b.quality ?? -1) },
    { title: uiText('Успеваемость'), dataIndex: 'success', align: 'right', render: (v: number | null) => <HeatCell value={v} low={70} high={100} />, sorter: (a, b) => (a.success ?? -1) - (b.success ?? -1) },
    { title: uiText('Посещаемость'), dataIndex: 'attendanceRate', align: 'right', render: (v: number | null) => <HeatCell value={v} low={70} high={100} />, sorter: (a, b) => (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1) },
    { title: uiText('Болеют'), dataIndex: 'illnessRate', align: 'right', render: (v: number | null) => <HeatCell value={v} low={0} high={15} invert />, sorter: (a, b) => (a.illnessRate ?? -1) - (b.illnessRate ?? -1) },
  ]

  const download = () =>
    exportRows(
      'rayony',
      rows.map((r) => ({
        [uiText('Район или город')]: placeName(r.district),
        [uiText('Область')]: placeName(r.region),
        [uiText('Школ')]: r.schools,
        [uiText('Учеников')]: r.students,
        [uiText('Учителей')]: r.teachers,
        [uiText('Учеников на учителя')]: r.studentsPerTeacher ?? '',
        [uiText('Средний балл')]: r.avgPercent ?? '',
        [uiText('Качество знаний')]: r.quality ?? '',
        [uiText('Успеваемость')]: r.success ?? '',
        [uiText('Посещаемость')]: r.attendanceRate ?? '',
        [uiText('Болеют')]: r.illnessRate ?? '',
      })),
      uiText('Районы'),
    )

  return (
    <div>
      <SproutPageHeader
        title={uiText('Сравнение районов')}
        description={uiText('Период: {0} — {1}. Чем зеленее ячейка, тем лучше показатель; для нагрузки и болезней — наоборот.', period.from, period.to)}
        icon={<MapPinned size={22} />}
        iconAccent="lilac"
        actions={
          <Button icon={<Download size={16} />} onClick={download} disabled={!rows.length}>
            {uiText('Выгрузить в Excel')}
          </Button>
        }
      />
      <MinistryFilterBar state={state} />

      {districts.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={uiText('Не удалось загрузить данные. Попробуйте обновить страницу.')} />}
      {districts.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Card title={<TableTitle title={uiText('Районы и города')} {...ministryTables().districts} />} styles={{ body: { padding: 0 } }}>
          <Table<DistrictRow>
            size="middle"
            rowKey={(r) => r.district?.id ?? 'none'}
            columns={helpColumns(columns, { rowLabel: (r) => [placeName(r.district), placeName(r.region)].join(' · '), help: ministryHelp<DistrictRow>() })}
            dataSource={rows}
            pagination={{ pageSize: 25, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}
    </div>
  )
}
