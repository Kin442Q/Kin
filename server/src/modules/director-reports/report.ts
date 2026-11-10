/** Operational education reports. No financial data or inferred final results. */
export interface ReportInput {
  from: string
  to: string
  effectiveTo: string
  generatedAt: string
  scale: 'unset' | 'five' | 'ten'
  thresholds: { pass: number; quality: number; excellent: number }
  groups: { id: string; name: string; homeroomTeacher?: string | null; students: { id: string; name: string }[] }[]
  subjects: { id: string; name: string }[]
  grades: { studentId: string; subjectId: string; authorId: string; value: number; date: string; type: string }[]
  attendance: { studentId: string; groupId: string; date: string; status: string }[]
  schedule: { groupId: string; subjectId: string | null; teacherId: string | null; dayOfWeek: number; startTime: string; endTime: string }[]
  teachers: { id: string; name: string; active: boolean }[]
  homework: { groupId: string; authorId: string; dueDate: string; submissions: { studentId: string; status: string }[] }[]
  movements: { enrolledAt: string; archivedAt: string | null }[]
}

const ratio = (n: number, total: number) => total ? Math.round(n / total * 1000) / 10 : null
const avg = (values: number[]) => values.length ? Math.round(values.reduce((a,b)=>a+b,0) / values.length * 100) / 100 : null
function indexRows<T>(rows: T[], key: (row:T)=>string): Map<string,T[]> {
  const index=new Map<string,T[]>()
  for(const row of rows){const id=key(row);const list=index.get(id);if(list)list.push(row);else index.set(id,[row])}
  return index
}
const minutes = (time: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const [h,m] = time.split(':').map(Number)
  return h*60+m
}

export function buildEducationReport(input: ReportInput) {
  const students = input.groups.flatMap(group=>group.students.map(student=>({...student,groupId:group.id,groupName:group.name,homeroomTeacher:group.homeroomTeacher??null})))
  const studentMap = new Map(students.map(student=>[student.id,student]))
  const subjectMap = new Map(input.subjects.map(subject=>[subject.id,subject.name]))
  const inPeriod = (date: string) => date >= input.from && date <= input.effectiveTo
  const rows = input.grades.filter(row=>studentMap.has(row.studentId) && subjectMap.has(row.subjectId) && inPeriod(row.date))
  const max = input.scale === 'ten' ? 10 : 5
  const valid = (value: number) => Number.isInteger(value) && value >= 1 && value <= max
  const classified = input.scale === 'unset' ? [] : rows.filter(row=>valid(row.value))
  const byStudent=indexRows(rows,row=>row.studentId)
  const classifiedByStudent=indexRows(classified,row=>row.studentId)
  const byGroup=indexRows(rows,row=>studentMap.get(row.studentId)!.groupId)
  const byGroupSubject=indexRows(rows,row=>studentMap.get(row.studentId)!.groupId+'|'+row.subjectId)
  const byTeacher=indexRows(rows,row=>row.authorId)
  const byDate=indexRows(rows,row=>row.date)
  const excludedGrades = input.scale === 'unset' ? 0 : rows.length-classified.length
  const bands = (grades: typeof rows) => ({
    count: grades.length,
    average: input.scale === 'unset' ? null : avg(grades.filter(g=>valid(g.value)).map(g=>g.value)),
    poor: input.scale === 'unset' ? null : grades.filter(g=>valid(g.value) && g.value<input.thresholds.pass).length,
    quality: input.scale === 'unset' ? null : grades.filter(g=>valid(g.value) && g.value>=input.thresholds.quality).length,
    excellent: input.scale === 'unset' ? null : grades.filter(g=>valid(g.value) && g.value>=input.thresholds.excellent).length,
  })
  const pairs = new Set(rows.map(row=>`${row.studentId}|${row.subjectId}`))
  const schedule = input.schedule.filter(row=>input.groups.some(group=>group.id===row.groupId))
  const groupSubjects = new Map(input.groups.map(group=>[group.id,new Set(schedule.filter(row=>row.groupId===group.id && row.subjectId && subjectMap.has(row.subjectId)).map(row=>row.subjectId!))]))
  const coverage = (groupId: string, subjectId?: string) => {
    const group = input.groups.find(group=>group.id===groupId)!
    const subjectIds = subjectId ? [subjectId] : [...groupSubjects.get(groupId)!]
    const expected = group.students.length*subjectIds.length
    const assessed = group.students.reduce((sum,student)=>sum+subjectIds.filter(id=>pairs.has(`${student.id}|${id}`)).length,0)
    return { expected, assessed, percent: ratio(assessed,expected) }
  }
  const attendance = input.attendance.filter(row=>studentMap.get(row.studentId)?.groupId===row.groupId && inPeriod(row.date))
  // The database allows one record per student/day. Guard imported inputs as well.
  const attendanceRows = [...new Map(attendance.map(row=>[`${row.studentId}|${row.date}`,row])).values()]
  const attendanceByStudent=indexRows(attendanceRows,row=>row.studentId)
  const attendanceByGroup=indexRows(attendanceRows,row=>row.groupId)
  const attendanceByDate=indexRows(attendanceRows,row=>row.date)
  const attendanceStats = (records: typeof attendanceRows) => {
    const present=records.filter(row=>row.status==='PRESENT').length
    const absent=records.filter(row=>row.status==='ABSENT').length
    const sick=records.filter(row=>row.status==='SICK').length
    const vacation=records.filter(row=>row.status==='VACATION').length
    return { records: records.length, present, absent, sick, vacation,
      absenceShare: ratio(absent+sick+vacation,records.length) }
  }
  const groups = input.groups.map(group=>{
    const marks=(byGroup.get(group.id)??[]).filter(row=>input.scale!=='unset'&&valid(row.value))
    const assessedStudents=new Set(marks.map(row=>row.studentId)).size
    const studentsWithPoor=input.scale==='unset'?null:new Set(marks.filter(row=>row.value<input.thresholds.pass).map(row=>row.studentId)).size
    return {
    id:group.id, name:group.name, students:group.students.length,
    ...bands(byGroup.get(group.id)??[]),
    coverage:coverage(group.id), subjects:groupSubjects.get(group.id)!.size,
    attendance:attendanceStats(attendanceByGroup.get(group.id)??[]),
    assessedStudents:input.scale==='unset'?null:assessedStudents,
    studentsWithPoor,
    poorStudentShare:studentsWithPoor==null?null:ratio(studentsWithPoor,assessedStudents),
  }})
  const matrix = input.groups.flatMap(group=>[...groupSubjects.get(group.id)!].map(subjectId=>({
    groupId:group.id, groupName:group.name, subjectId, subjectName:subjectMap.get(subjectId)!,
    ...bands(byGroupSubject.get(group.id+'|'+subjectId)??[]),
    coverage:coverage(group.id,subjectId),
  })))
  const support = students.map(student=>{
    const marks=classifiedByStudent.get(student.id)??[]
    const missing=[...groupSubjects.get(student.groupId)!].filter(id=>!pairs.has(`${student.id}|${id}`))
    return {
      ...student,
      poor: input.scale==='unset' ? null : marks.filter(row=>row.value<input.thresholds.pass).length,
      subjectSupport:[...new Set(marks.filter(row=>row.value<input.thresholds.pass).map(row=>row.subjectId))].map(subjectId=>{
        const subjectMarks=marks.filter(row=>row.subjectId===subjectId)
        return {subjectId,subjectName:subjectMap.get(subjectId)!,average:avg(subjectMarks.map(row=>row.value)),lowMarks:subjectMarks.filter(row=>row.value<input.thresholds.pass).map(row=>({value:row.value,date:row.date})).sort((a,b)=>b.date.localeCompare(a.date))}
      }),
      poorSubjects:[...new Set(marks.filter(row=>row.value<input.thresholds.pass).map(row=>subjectMap.get(row.subjectId)!))],
      missingSubjects:missing.map(id=>subjectMap.get(id)!),
      absentDays:(attendanceByStudent.get(student.id)??[]).filter(row=>row.status==='ABSENT').length,
      lastGrade:(byStudent.get(student.id)??[]).map(row=>row.date).sort().slice(-1)[0] ?? null,
    }
  }).filter(row=>(row.poor??0)>0 || row.missingSubjects.length>0 || row.absentDays>=3)
    .sort((a,b)=>(b.poor??0)-(a.poor??0)||b.absentDays-a.absentDays||a.name.localeCompare(b.name))
  const teacherMap = new Map(input.teachers.map(teacher=>[teacher.id,teacher]))
  let invalidSchedule=0
  for(const lesson of schedule){const start=minutes(lesson.startTime),end=minutes(lesson.endTime);if(start==null||end==null||end<=start||lesson.dayOfWeek<1||lesson.dayOfWeek>7)invalidSchedule++}
  const teacherIds=new Set([...input.teachers.map(t=>t.id),...schedule.flatMap(row=>row.teacherId?[row.teacherId]:[])])
  const teachers=[...teacherIds].map(id=>{
    const teacher=teacherMap.get(id)
    const lessons=schedule.filter(row=>row.teacherId===id)
    let plannedMinutes=0, validLessons=0
    for(const lesson of lessons){const start=minutes(lesson.startTime),end=minutes(lesson.endTime);if(start!=null&&end!=null&&end>start&&lesson.dayOfWeek>=1&&lesson.dayOfWeek<=7){plannedMinutes+=end-start;validLessons++}}
    return {id,name:teacher?.name??id,active:teacher?.active??false,lessonsPerWeek:validLessons,plannedMinutes,
      classes:new Set(lessons.map(row=>row.groupId)).size,
      grades:(byTeacher.get(id)??[]).length,
      gradeDays:new Set((byTeacher.get(id)??[]).map(row=>row.date)).size,
      homework:input.homework.filter(row=>row.authorId===id && inPeriod(row.dueDate)).length}
  }).sort((a,b)=>b.lessonsPerWeek-a.lessonsPerWeek||a.name.localeCompare(b.name))
  const daily = [...attendanceByDate.keys()].sort().map(date=>({date,...attendanceStats(attendanceByDate.get(date)!)}))
  const gradeTrend=[...byDate.keys()].sort().map(date=>({date,...bands(byDate.get(date)!)}))
  const diagnosticRows=indexRows(rows.filter(row=>['CONTROL','EXAM'].includes(row.type)),row=>row.subjectId)
  const diagnostics=[...diagnosticRows.keys()].map(subjectId=>({
    subjectId,subjectName:subjectMap.get(subjectId)!,
    ...bands(diagnosticRows.get(subjectId)!),
    students:new Set(diagnosticRows.get(subjectId)!.map(row=>row.studentId)).size,
  }))
  const expected=groups.reduce((sum,row)=>sum+row.coverage.expected,0), assessed=groups.reduce((sum,row)=>sum+row.coverage.assessed,0)
  const unscheduledGrades=rows.filter(row=>!groupSubjects.get(studentMap.get(row.studentId)!.groupId)?.has(row.subjectId)).length
  return {
    version:1, generatedAt:input.generatedAt,
    period:{from:input.from,to:input.to,effectiveTo:input.effectiveTo},
    methodology:{scale:input.scale,thresholds:input.thresholds,roster:'current' as const,attendanceUnit:'student-day' as const},
    summary:{students:students.length,classes:groups.length,teachers:input.teachers.filter(row=>row.active).length,
      ...bands(rows),coverage:{expected,assessed,percent:ratio(assessed,expected)},
      studentsWithPoor: input.scale==='unset'?null:new Set(classified.filter(row=>row.value<input.thresholds.pass).map(row=>row.studentId)).size,
      attendance:attendanceStats(attendanceRows),
      absoluteAchievement:null,qualityAchievement:null,sou:null,
    },
    groups,matrix,support,teachers,daily,gradeTrend,diagnostics,
    movements:{enrolled:input.movements.filter(row=>inPeriod(row.enrolledAt)).length,archived:input.movements.filter(row=>row.archivedAt&&inPeriod(row.archivedAt)).length},
    dataQuality:{excludedGrades,unscheduledGrades,classesWithoutSchedule:groups.filter(row=>!row.subjects).length,
      unassignedLessons:schedule.filter(row=>!row.teacherId).length,inactiveTeacherLessons:schedule.filter(row=>row.teacherId&&!teacherMap.get(row.teacherId)?.active).length,invalidSchedule},
    availability:{finalResults:false,lessonExecution:false,curriculumPlan:false,attendanceByLesson:false,absenceReasons:false,discipline:false,exams:false,approvedForms:false,historicalRoster:false},
  }
}

export type EducationReport = ReturnType<typeof buildEducationReport>
