import { buildEducationReport, type ReportInput } from './report'

function input(patch: Partial<ReportInput> = {}): ReportInput {
  return {from:'2026-11-01',to:'2026-11-30',effectiveTo:'2026-11-10',generatedAt:'2026-11-10T10:00:00Z',scale:'unset',thresholds:{pass:3,quality:4,excellent:5},
    groups:[{id:'g1',name:'5А',students:[{id:'a',name:'Ali'},{id:'b',name:'Madina'}]}],subjects:[{id:'math',name:'Math'},{id:'rus',name:'Russian'}],
    schedule:[{groupId:'g1',subjectId:'math',teacherId:'t1',dayOfWeek:1,startTime:'08:00',endTime:'08:45'},{groupId:'g1',subjectId:'rus',teacherId:'t1',dayOfWeek:2,startTime:'08:00',endTime:'08:45'}],
    grades:[],attendance:[],teachers:[{id:'t1',name:'Teacher',active:true}],homework:[],movements:[],...patch}
}
const grade=(value:number,patch:Partial<ReportInput['grades'][number]>={})=>({studentId:'a',subjectId:'math',authorId:'t1',date:'2026-11-03',type:'CLASSWORK',value,...patch})

describe('education report methodology',()=>{
  it('never infers a scale from grades and never substitutes current marks for final results',()=>{
    const report=buildEducationReport(input({grades:[grade(10)]}))
    expect(report.methodology.scale).toBe('unset')
    expect(report.summary.average).toBeNull()
    expect(report.summary.studentsWithPoor).toBeNull()
    expect(report.summary.absoluteAchievement).toBeNull()
    expect(report.summary.qualityAchievement).toBeNull()
    expect(report.summary.sou).toBeNull()
  })
  it('interprets low ten-point grades consistently, including values at or below five',()=>{
    const report=buildEducationReport(input({scale:'ten',thresholds:{pass:5,quality:7,excellent:9},grades:[grade(2),grade(5),grade(9)]}))
    expect(report.summary.poor).toBe(1)
    expect(report.summary.excellent).toBe(1)
    expect(report.summary.average).toBe(5.33)
    expect(report.summary.studentsWithPoor).toBe(1)
  })
  it('excludes out-of-scale values and exposes the exclusion count',()=>{
    const report=buildEducationReport(input({scale:'five',grades:[grade(9),grade(4)]}))
    expect(report.dataQuality.excludedGrades).toBe(1)
    expect(report.summary.average).toBe(4)
    expect(report.summary.count).toBe(2)
  })
  it('counts unique student–subject pairs and never assumes every school subject is scheduled',()=>{
    const report=buildEducationReport(input({grades:[grade(4),grade(5),grade(3)]}))
    expect(report.summary.coverage).toEqual({expected:4,assessed:1,percent:25})
    const noSchedule=buildEducationReport(input({schedule:[],grades:[grade(4)]}))
    expect(noSchedule.summary.coverage.percent).toBeNull()
    expect(noSchedule.dataQuality.unscheduledGrades).toBe(1)
  })
  it('keeps missing attendance distinct from recorded absence and uses student-days',()=>{
    const empty=buildEducationReport(input())
    expect(empty.summary.attendance.absenceShare).toBeNull()
    const rows=[{studentId:'a',groupId:'g1',date:'2026-11-03',status:'PRESENT'},{studentId:'b',groupId:'g1',date:'2026-11-03',status:'ABSENT'}]
    const report=buildEducationReport(input({attendance:[...rows,rows[0]]}))
    expect(report.summary.attendance).toMatchObject({records:2,present:1,absent:1,absenceShare:50})
    expect(report.methodology.attendanceUnit).toBe('student-day')
    expect(report.availability.absenceReasons).toBe(false)
  })
  it('excludes future and foreign student records from selected observations',()=>{
    const report=buildEducationReport(input({grades:[grade(5),grade(1,{date:'2026-11-20'}),grade(1,{studentId:'other'}),grade(1,{date:'2026-10-31'})]}))
    expect(report.summary.count).toBe(1)
    expect(report.support.every(row=>row.id!=='other')).toBe(true)
  })
  it('shows lack of current assessment as a support signal, not a failed final result',()=>{
    const report=buildEducationReport(input())
    expect(report.support[0].poor).toBeNull()
    expect(report.support[0].missingSubjects).toEqual(['Math','Russian'])
    expect(report.summary.coverage.percent).toBe(0)
    expect(report.availability.finalResults).toBe(false)
  })
  it('reports weekly planned workload independently of observations in a date range',()=>{
    const report=buildEducationReport(input({grades:[grade(5)],movements:[{enrolledAt:'2026-11-02',archivedAt:null},{enrolledAt:'2025-01-01',archivedAt:'2026-11-04'}]}))
    expect(report.teachers[0]).toMatchObject({lessonsPerWeek:2,plannedMinutes:90,grades:1})
    expect(report.movements).toEqual({enrolled:1,archived:1})
    expect(report.availability.lessonExecution).toBe(false)
  })
  it('does not include invalid timetable entries in planned teaching time',()=>{
    const base=input()
    const report=buildEducationReport({...base,schedule:[...base.schedule,{...base.schedule[0],endTime:'07:00'}]})
    expect(report.dataQuality.invalidSchedule).toBe(1)
    expect(report.teachers[0].plannedMinutes).toBe(90)
    expect(report.teachers[0].lessonsPerWeek).toBe(2)
  })
})
