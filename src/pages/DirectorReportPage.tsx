import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Descriptions, Empty, InputNumber, Progress, Select, Space, Spin, Table, Tabs, Tag, Tooltip } from 'antd'
import { ClipboardList, Download, Printer, RefreshCw } from 'lucide-react'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { SP, SproutCard, SproutKPI, SproutPageHeader } from '../components/sprout'
import { directorReportsApi, type EducationReport, type ReportFilters } from '../api/directorReportsApi'
import { termsApi, type TermDto } from '../api/termsApi'
import { useDataStore } from '../store/dataStore'
import { uiLanguage, uiText as t } from '../i18n/uiText'
import { useLangStore } from '../i18n'

const pct = (value: number | null) => value == null ? '—' : value.toLocaleString(uiLanguage(), {maximumFractionDigits:1}) + '%'
const num = (value: number | null) => value == null ? '—' : value.toLocaleString(uiLanguage(), {maximumFractionDigits:2})
const date = (value: string) => dayjs(value).format('DD.MM.YYYY')

function AttendanceTrend({rows}: {rows: EducationReport['daily']}) {
  const points=rows.slice(-31), max=Math.max(1,...points.map(row=>row.records))
  return <div>
    <div role="img" aria-label={t('Динамика зарегистрированной посещаемости')} style={{height:150,display:'flex',alignItems:'flex-end',gap:4,padding:'12px 0',overflowX:'auto'}}>
      {points.map(row=><Tooltip key={row.date} title={date(row.date)+': '+t('Присутствуют')+' '+row.present+' · '+t('Пропуски')+' '+(row.absent+row.sick+row.vacation)}>
        <div style={{flex:1,minWidth:5,height:Math.max(2,row.records/max*120),display:'flex',flexDirection:'column',borderRadius:4,overflow:'hidden'}}>
          <div style={{flex:row.absent+row.sick+row.vacation,background:SP.rose}} />
          <div style={{flex:row.present,background:SP.primary}} />
        </div>
      </Tooltip>)}
    </div>
    <small>{t('Последние 31 дата с записями. Отсутствие записи не считается присутствием.')} {points.length>0&&date(points[0].date)+' — '+date(points[points.length-1].date)}</small>
  </div>
}

export default function DirectorReportPage() {
  const lang=useLangStore(state=>state.lang)
  const groups=useDataStore(state=>state.groups)
  const [terms,setTerms]=useState<TermDto[]>([])
  const [preset,setPreset]=useState('month')
  const [filters,setFilters]=useState<ReportFilters>({from:dayjs().startOf('month').format('YYYY-MM-DD'),to:dayjs().format('YYYY-MM-DD'),scale:'unset'})
  const [report,setReport]=useState<EducationReport|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [tab,setTab]=useState('overview')
  const [exporting,setExporting]=useState<'XLSX'|'PDF'|null>(null)
  const [reload,setReload]=useState(0)
  useEffect(()=>{termsApi.list().then(setTerms).catch(()=>{})},[])
  useEffect(()=>{
    const controller=new AbortController()
    setLoading(true);setReport(null);setError(null)
    directorReportsApi.overview(filters,controller.signal).then(data=>{if(!controller.signal.aborted)setReport(data)}).catch(err=>{if(!controller.signal.aborted)setError(err?.response?.data?.message || 'Не удалось загрузить отчёт')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[filters,reload])
  const choosePeriod=(value:string)=>{
    setPreset(value)
    if(value==='custom')return
    const today=dayjs(),term=terms.find(term=>term.id===value)
    let from=today.startOf('month'),to=today
    if(term){from=dayjs(term.startDate);to=dayjs(term.endDate)}
    else if(value==='week')from=today.subtract((today.day()+6)%7,'day')
    else if(value==='year')from=dayjs((today.month()<8?today.year()-1:today.year())+'-09-01')
    setFilters(current=>({...current,from:from.format('YYYY-MM-DD'),to:to.format('YYYY-MM-DD')}))
  }
  const changeScale=(scale:ReportFilters['scale'])=>setFilters(current=>({...current,scale,pass:scale==='ten'?5:3,quality:scale==='ten'?7:4,excellent:scale==='ten'?9:5}))
  const matrixSubjects=useMemo(()=>[...new Map(report?.matrix.map(row=>[row.subjectId,row.subjectName])??[])],[report])
  const availability=[
    ['Итоговая успеваемость и СОУ','Нужны утверждённые итоговые результаты, статусы аттестации и методика расчёта.'],
    ['Исполнение учебного плана','Нужны учебный план, календарь, отмены, замены и фактически проведённые уроки.'],
    ['Своевременность ведения журнала','Нужны журнал проведённых уроков, обязательные поля и утверждённые сроки заполнения.'],
    ['Пропуски по урокам и дисциплина','Сейчас посещаемость ведётся по дням. Причины отсутствия и дисциплинарные события отдельно не регистрируются.'],
    ['Аттестация и внешние диагностики','Нужны отдельные записи об участниках, допуске, результатах и повторных процедурах.'],
    ['Ведомственные формы','Нужны утверждённые региональные шаблоны, версии и правила заполнения.'],
    ['Исторический контингент','Нужна история переводов между классами и статусов на отчётную дату.'],
  ]
  const exportReport=async(format:'XLSX'|'PDF')=>{
    setExporting(format)
    try {
    const report=await directorReportsApi.export(filters,format)
    setReport(report)
    if(format==='PDF'){requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));return}
    const book=XLSX.utils.book_new()
    const add=(name:string,rows:Record<string,unknown>[])=>XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows.length?rows:[{[t('Статус')]:t('Нет данных')}]),t(name).slice(0,31))
    add('Методика',[{[t('Начало')]:filters.from,[t('Конец')]:filters.to,[t('Данные до')]:report.period.effectiveTo,[t('Сформирован')]:report.generatedAt,[t('Шкала анализа')]:t(report.methodology.scale==='unset'?'Не выбрана':report.methodology.scale==='five'?'Пятибалльная':'Десятибалльная'),[t('Тип отчёта')]:t('Оперативный; не ведомственная форма'),[t('Состав')]:t('Текущий контингент'),[t('Порог положительной оценки')]:report.methodology.scale==='unset'?null:report.methodology.thresholds.pass,[t('Порог качества')]:report.methodology.scale==='unset'?null:report.methodology.thresholds.quality,[t('Порог отличной оценки')]:report.methodology.scale==='unset'?null:report.methodology.thresholds.excellent}])
    add('Классы',report.groups.map(row=>({[t('Класс')]:row.name,[t('Учеников')]:row.students,[t('Текущих отметок')]:row.count,[t('Средний балл')]:row.average,[t('Охват оцениванием')]:row.coverage.percent,[t('Пар с оценками')]:row.coverage.assessed,[t('Пар по расписанию')]:row.coverage.expected})))
    add('Предметы',report.matrix.map(row=>({[t('Класс')]:row.groupName,[t('Предмет')]:row.subjectName,[t('Средний балл')]:row.average,[t('Текущих отметок')]:row.count,[t('Охват оцениванием')]:row.coverage.percent})))
    add('Посещаемость',report.daily.map(row=>({[t('Дата')]:row.date,[t('Присутствуют')]:row.present,[t('Отсутствие без уточнения')]:row.absent,[t('Болеют')]:row.sick,[t('В отпуске')]:row.vacation,[t('Записей')]:row.records})))
    add('Учебная поддержка',report.support.map(row=>({[t('ФИО')]:row.name,[t('Класс')]:row.groupName,[t('Низких текущих отметок')]:row.poor,[t('Предметы с низкими отметками')]:row.poorSubjects.join(', '),[t('Нет оценок по предметам')]:row.missingSubjects.join(', '),[t('Дней отсутствия без уточнения')]:row.absentDays})))
    add('Нагрузка',report.teachers.map(row=>({[t('Учитель')]:row.name,[t('Уроков в неделю')]:row.lessonsPerWeek,[t('Минут по расписанию')]:row.plannedMinutes,[t('Классов')]:row.classes,[t('Внесено оценок')]:row.grades,[t('Задано ДЗ')]:row.homework})))
    add('Доступность данных',availability.map(([name,reason])=>({[t('Отчёт')]:t(name),[t('Основание')]:t(reason)})))
    XLSX.writeFile(book,'director-report-'+filters.from+'-'+filters.to+'.xlsx')
    } catch(error: any) { setError(error?.response?.data?.message || 'Не удалось подготовить экспорт отчёта') }
    finally { setExporting(null) }
  }
  const formatAverage=(v:number|null)=>num(v)
  const quality=report?.dataQuality
  const warnings=quality?[['Оценок вне выбранной шкалы',quality.excludedGrades],['Оценок по предметам вне расписания',quality.unscheduledGrades],['Классов без предметов в расписании',quality.classesWithoutSchedule],['Уроков без учителя',quality.unassignedLessons],['Уроков с неактивным учителем',quality.inactiveTeacherLessons],['Ошибок времени в расписании',quality.invalidSchedule]].filter(([,count])=>Number(count)>0):[]
  const summary=report?.summary
  const tableProps={pagination:{pageSize:15,showSizeChanger:true},size:'small' as const,scroll:{x:780},locale:{emptyText:t('Нет данных')}}
  const kpi=(label:string,value:unknown,hint:string,accent:'mint'|'blue'|'yellow'|'rose'='mint')=><SproutKPI label={t(label)} value={value==null?'—':String(value)} hint={t(hint)} accent={accent}/>
  const gradeColumns=[{title:t('Предмет'),dataIndex:'subjectName'},{title:t('Текущих отметок'),dataIndex:'count'},{title:t('Средний балл'),dataIndex:'average',render:formatAverage},{title:t('Низких текущих отметок'),dataIndex:'poor',render:num},{title:t('Оценок высокого уровня'),dataIndex:'quality',render:num}]
  return <div className="director-report" data-language={lang}>
    <SproutPageHeader title={t('Отчёты для директора')} description={t('Учебный процесс, посещаемость, журналы и педагогическая нагрузка')} icon={<ClipboardList size={22}/>} iconAccent="blue" actions={<Space wrap className="director-actions"><Button icon={<RefreshCw size={16}/>} onClick={()=>setReload(value=>value+1)}>{t('Обновить')}</Button><Button icon={<Download size={16}/>} loading={exporting==='XLSX'} disabled={!report||loading||!!exporting} onClick={()=>exportReport('XLSX')}>{t('Экспорт XLSX')}</Button><Button icon={<Printer size={16}/>} loading={exporting==='PDF'} disabled={!report||loading||!!exporting} onClick={()=>exportReport('PDF')}>{t('Печать / PDF')}</Button></Space>}/>
    <SproutCard style={{marginBottom:16}}>
      <Space wrap className="director-filters" size={[12,12]}>
        <Select disabled={!!exporting} aria-label={t('Период')} value={preset} onChange={choosePeriod} style={{width:190}} options={[{value:'week',label:t('Учебная неделя')},{value:'month',label:t('Текущий месяц')},{value:'year',label:t('Учебный год')},...terms.map(term=>({value:term.id,label:term.name})),{value:'custom',label:t('Свой период')}]}/>
        <DatePicker.RangePicker disabled={!!exporting} aria-label={t('Даты отчёта')} allowClear={false} value={[dayjs(filters.from),dayjs(filters.to)]} format="DD.MM.YYYY" onChange={values=>{if(values?.[0]&&values[1]){setPreset('custom');setFilters(current=>({...current,from:values[0]!.format('YYYY-MM-DD'),to:values[1]!.format('YYYY-MM-DD')}))}}}/>
        <Select disabled={!!exporting} aria-label={t('Класс')} allowClear placeholder={t('Все классы')} value={filters.groupId} onChange={groupId=>setFilters(current=>({...current,groupId}))} style={{width:170}} options={groups.map(group=>({value:group.id,label:group.name}))}/>
        <Select disabled={!!exporting} aria-label={t('Шкала анализа')} value={filters.scale} style={{width:220}} onChange={changeScale} options={[{value:'unset',label:t('Шкала: не выбрана')},{value:'five',label:t('Пятибалльная')},{value:'ten',label:t('Десятибалльная')}]}/>
        {filters.scale!=='unset'&&(['pass','quality','excellent'] as const).map((key,index)=><label key={key} style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>{t(['Порог положительной оценки','Порог качества','Порог отличной оценки'][index])}<InputNumber disabled={!!exporting} aria-label={t(['Порог положительной оценки','Порог качества','Порог отличной оценки'][index])} min={1} max={filters.scale==='ten'?10:5} precision={0} value={filters[key]} style={{width:62}} onChange={value=>{if(value!=null)setFilters(current=>({...current,[key]:value}))}}/></label>)}
      </Space>
      <p style={{color:SP.muted,fontSize:12,marginBottom:0}}>{t('Шкала и пороги задаются явно. Наличие оценки выше 5 не переключает шкалу автоматически.')}</p>
    </SproutCard>
    <Alert type="info" showIcon message={t('Оперативная аналитика по текущему составу школы')} description={t('Текущие отметки не заменяют итоговую аттестацию. Охват оцениванием не равен заполненности журналов. Посещаемость учитывается по ученико-дням, а не по урокам.')} style={{marginBottom:16}}/>
    {error&&<Alert type="error" showIcon message={t(error)} action={<Button onClick={()=>setReload(value=>value+1)}>{t('Попробовать снова')}</Button>} style={{marginBottom:16}}/>}
    {loading?<div style={{padding:48,textAlign:'center'}}><Spin/></div>:report&&summary?<>
      <div style={{fontSize:12,color:SP.muted,marginBottom:12}}>{t('Сформирован')}: {dayjs(report.generatedAt).format('DD.MM.YYYY HH:mm')} · {t('Данные до')}: {date(report.period.effectiveTo)} · {t('Версия методики')}: {report.version}</div>
      <Tabs activeKey={tab} onChange={setTab} items={[
        {key:'overview',label:t('Состояние школы'),children:<>
          <div className="director-kpis">{kpi('Учеников',summary.students,'Текущий контингент')}{kpi('Классов',summary.classes,'Действующие классы','blue')}{kpi('Охват оцениванием',pct(summary.coverage.percent),'По предметам текущего расписания','yellow')}{kpi('Нужна учебная поддержка',report.support.length,'Оперативные сигналы; не академическая задолженность','rose')}</div>
          <SproutCard style={{marginTop:16}}><h3>{t('Сигналы качества данных')}</h3>{warnings.length?<Space direction="vertical">{warnings.map(([label,count])=><div key={label}><Tag color="warning">{count}</Tag>{t(String(label))}</div>)}</Space>:<p>{t('В доступных записях отклонений не обнаружено')}</p>}<p style={{fontSize:12,color:SP.muted}}>{t('Отсутствующие источники не считаются проверенными. См. раздел «Методика и источники».')}</p></SproutCard>
          <SproutCard style={{marginTop:16}}><h3>{t('Каждый класс')}</h3><Table {...tableProps} rowKey="id" dataSource={report.groups} columns={[{title:t('Класс'),dataIndex:'name'},{title:t('Учеников'),dataIndex:'students'},{title:t('Текущих отметок'),dataIndex:'count'},{title:t('Средний балл'),dataIndex:'average',render:formatAverage},{title:t('Охват оцениванием'),render:(_,row)=><Tooltip title={row.coverage.assessed+' / '+row.coverage.expected}>{row.coverage.percent==null?'—':<Progress percent={row.coverage.percent} size="small"/>}</Tooltip>},{title:t('Низких текущих отметок'),dataIndex:'poor',render:num}]}/></SproutCard>
        </>},
        {key:'learning',label:t('Качество обучения'),children:<>
          <div className="director-kpis">{kpi('Текущих отметок',summary.count,'За выбранный период')}{kpi('Средний балл',num(summary.average),'Только в выбранной шкале','blue')}{kpi('Учеников с низкими отметками',summary.studentsWithPoor,'Не является итоговой неуспеваемостью','rose')}{kpi('Итоговая успеваемость',null,'Нет итоговых результатов','yellow')}</div>
          {filters.scale==='unset'&&<Alert type="warning" showIcon message={t('Выберите шкалу для анализа отметок')} style={{marginTop:16}}/>}
          <SproutCard style={{marginTop:16}}><h3>{t('Карта охвата: класс × предмет')}</h3><p>{t('В ячейке — доля учеников хотя бы с одной отметкой. Серый цвет означает отсутствие основания для расчёта.')}</p><Table {...tableProps} pagination={false} rowKey="id" dataSource={report.groups} columns={[{title:t('Класс'),dataIndex:'name',fixed:'left',width:110},...matrixSubjects.map(([id,name])=>({title:name,key:id,width:150,render:(_:unknown,group:EducationReport['groups'][number])=>{const row=report.matrix.find(row=>row.groupId===group.id&&row.subjectId===id);const value=row?.coverage.percent??null;return <Tooltip title={row?row.coverage.assessed+' / '+row.coverage.expected:t('Нет предмета в расписании')}><div style={{padding:10,borderRadius:8,background:value==null?SP.surfaceAlt:value<50?SP.roseSoft:SP.primarySoft}}>{pct(value)}</div></Tooltip>}}))]}/></SproutCard>
          <SproutCard style={{marginTop:16}}><h3>{t('Текущие контрольные и экзаменационные отметки')}</h3><p>{t('Это записи типов CONTROL и EXAM, а не реестр государственной аттестации. Охват участием и результаты по заданиям не рассчитываются.')}</p><Table {...tableProps} rowKey="subjectId" dataSource={report.diagnostics} columns={gradeColumns}/></SproutCard>
        </>},
        {key:'support',label:t('Учебная поддержка'),children:<SproutCard><Alert type="info" showIcon message={t('Основания: низкие текущие отметки, отсутствие оценок по предметам расписания или минимум 3 дня отсутствия без уточнения причины.')} style={{marginBottom:16}}/><Table {...tableProps} rowKey="id" dataSource={report.support} columns={[{title:t('ФИО'),dataIndex:'name',fixed:'left'},{title:t('Класс'),dataIndex:'groupName'},{title:t('Низких текущих отметок'),dataIndex:'poor',render:num},{title:t('Предметы с низкими отметками'),dataIndex:'poorSubjects',render:(values:string[])=>values.join(', ')||'—'},{title:t('Нет оценок по предметам'),dataIndex:'missingSubjects',render:(values:string[])=>values.join(', ')||'—'},{title:t('Дней отсутствия без уточнения'),dataIndex:'absentDays'},{title:t('Последняя оценка'),dataIndex:'lastGrade',render:(value:string|null)=>value?date(value):'—'}]}/></SproutCard>},
        {key:'attendance',label:t('Посещаемость'),children:<>
          <div className="director-kpis">{kpi('Записей посещаемости',summary.attendance.records,'Ученико-дни с отметкой')}{kpi('Присутствуют',summary.attendance.present,'Ученико-дни','blue')}{kpi('Отсутствие без уточнения',summary.attendance.absent,'Не равно неуважительной причине','rose')}{kpi('Доля пропусков среди записей',pct(summary.attendance.absenceShare),'Не доля от плановых уроков','yellow')}</div>
          <SproutCard style={{marginTop:16}}><h3>{t('Динамика зарегистрированной посещаемости')}</h3>{report.daily.length?<AttendanceTrend rows={report.daily}/>:<Empty description={t('Нет данных')}/>}<Table {...tableProps} rowKey="date" dataSource={report.daily} columns={[{title:t('Дата'),dataIndex:'date',render:date},{title:t('Присутствуют'),dataIndex:'present'},{title:t('Отсутствие без уточнения'),dataIndex:'absent'},{title:t('Болеют'),dataIndex:'sick'},{title:t('В отпуске'),dataIndex:'vacation'},{title:t('Записей'),dataIndex:'records'}]}/></SproutCard>
        </>},
        {key:'journals',label:t('Журналы и учебный план'),children:<SproutCard><Alert type="info" showIcon message={t('Показатель доступности — охват текущими отметками')} description={t('Нельзя считать урок проведённым по наличию оценки или записи в недельном расписании. Просроченные записи и выполнение учебного плана без фактического журнала уроков не рассчитываются.')} style={{marginBottom:16}}/><Table {...tableProps} rowKey={row=>row.groupId+'-'+row.subjectId} dataSource={report.matrix} columns={[{title:t('Класс'),dataIndex:'groupName'},{title:t('Предмет'),dataIndex:'subjectName'},{title:t('Пар с оценками'),render:(_,row)=>row.coverage.assessed},{title:t('Пар по расписанию'),render:(_,row)=>row.coverage.expected},{title:t('Охват оцениванием'),render:(_,row)=>pct(row.coverage.percent)}]}/></SproutCard>},
        {key:'teachers',label:t('Кадры и нагрузка'),children:<SproutCard><Alert type="info" showIcon message={t('Недельная нагрузка по текущему расписанию')} description={t('Количество внесённых оценок и домашних заданий отражает записи в системе, а не фактически проведённые часы и не качество работы педагога.')} style={{marginBottom:16}}/><Table {...tableProps} rowKey="id" dataSource={report.teachers} columns={[{title:t('Учитель'),dataIndex:'name'},{title:t('Статус'),dataIndex:'active',render:(value:boolean)=><Tag color={value?'green':'default'}>{t(value?'Активен':'Отключён')}</Tag>},{title:t('Уроков в неделю'),dataIndex:'lessonsPerWeek'},{title:t('Минут по расписанию'),dataIndex:'plannedMinutes'},{title:t('Классов'),dataIndex:'classes'},{title:t('Внесено оценок'),dataIndex:'grades'},{title:t('Дней с внесением оценок'),dataIndex:'gradeDays'},{title:t('Задано ДЗ'),dataIndex:'homework'}]}/></SproutCard>},
        {key:'roster',label:t('Контингент'),children:<SproutCard><Descriptions bordered column={1} items={[{key:'active',label:t('Текущий контингент'),children:summary.students},{key:'classes',label:t('Действующие классы'),children:summary.classes},{key:'enrolled',label:t('Зачислено в системе за период'),children:report.movements.enrolled},{key:'archived',label:t('Архивировано в системе за период'),children:report.movements.archived}]}/><Alert style={{marginTop:16}} type="info" showIcon message={t('Архивация не является подтверждённым выбытием. Историческая численность и основания переводов в базе не хранятся.')}/></SproutCard>},
        {key:'sources',label:t('Методика и источники'),children:<SproutCard><h3>{t('Доступность официальных отчётов')}</h3><Table {...tableProps} pagination={false} rowKey={row=>row[0]} dataSource={availability} columns={[{title:t('Отчёт'),render:(_,row)=>t(row[0])},{title:t('Статус'),render:()=> <Tag>{t('Нет источника данных')}</Tag>},{title:t('Основание'),render:(_,row)=>t(row[1])}]}/><p>{t('Проценты считаются по исходным количествам. Пустой знаменатель отображается как «—». Итоговая успеваемость, качество знаний и СОУ не подменяются средними текущих отметок.')}</p><p>{t('Расписание и контингент — текущие снимки. Будущие даты в выбранном периоде не включаются в наблюдения. Экспорт — оперативная выгрузка без статуса утверждённой государственной формы.')}</p></SproutCard>},
      ]}/>
    </>:!error&&<Empty description={t('Нет данных')}/>}
    <style>{'.director-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.director-report .ant-table-cell{overflow-wrap:anywhere}@media(max-width:1000px){.director-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.director-kpis{grid-template-columns:1fr}.director-filters{width:100%}.director-filters .ant-picker{width:100%}}@media print{.director-actions,.director-filters,.ant-tabs-nav,aside,header,.app-sidebar-card{display:none!important}.director-report{color:#111;background:white}.director-report .sp-card{box-shadow:none;background:white;break-inside:avoid}.ant-table-container{overflow:visible!important}}'}</style>
  </div>
}
