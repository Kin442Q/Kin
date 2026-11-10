import { buildDirectorReport, gradeBand, type ReportGrade } from './director-report'

function grade(partial: Partial<ReportGrade> & Pick<ReportGrade, 'value' | 'studentId' | 'groupId'>): ReportGrade {
  return {
    date: '2026-11-01',
    studentName: partial.studentId,
    subjectId: 'math',
    subjectName: 'Математика',
    ...partial,
  }
}

const groups = [
  {
    id: 'g1',
    name: '5А',
    students: [
      { id: 'a', name: 'Алиева А' },
      { id: 'b', name: 'Баротов Б' },
    ],
  },
  {
    id: 'g2',
    name: '5Б',
    students: [{ id: 'c', name: 'Валиев В' }],
  },
]

describe('buildDirectorReport', () => {
  it('считает общий средний балл, отличные и плохие, полноту по расписанию', () => {
    const report = buildDirectorReport({
      groups,
      subjectsByGroup: new Map([
        ['g1', [{ id: 'math', name: 'Математика' }, { id: 'rus', name: 'Русский' }]],
      ]),
      schoolSubjects: [
        { id: 'math', name: 'Математика' },
        { id: 'rus', name: 'Русский' },
      ],
      grades: [
        grade({ value: 5, studentId: 'a', studentName: 'Алиева', groupId: 'g1', subjectId: 'math' }),
        grade({ value: 5, studentId: 'a', studentName: 'Алиева', groupId: 'g1', subjectId: 'math', date: '2026-11-02' }),
        grade({
          value: 2,
          studentId: 'b',
          studentName: 'Баротов',
          groupId: 'g1',
          subjectId: 'rus',
          subjectName: 'Русский',
          date: '2026-11-03',
        }),
        grade({ value: 4, studentId: 'c', studentName: 'Валиев', groupId: 'g2' }),
      ],
    })

    expect(report.scale).toBe('five')
    expect(report.summary.average).toBe(4)
    expect(report.summary.excellent).toBe(2)
    expect(report.summary.poor).toBe(1)
    expect(report.summary.good).toBe(1)
    // 5А: 2 ученика × 2 предмета, закрыты math у А и rus у Б → 2/4 = 50%
    // 5Б: расписания нет, предметы школы (2), одна оценка по math → 1/2 = 50%
    // вместе 3/6 = 50%
    expect(report.groups[0].completeness).toBe(50)
    expect(report.groups[1].completeness).toBe(50)
    expect(report.summary.completeness).toBe(50)
    expect(report.bestStudents[0].name).toBe('Алиева')
    expect(report.worstGrades[0]).toMatchObject({ name: 'Баротов', value: 2, subjectName: 'Русский' })
    expect(report.groups[0].lowest).toMatchObject({ name: 'Баротов', value: 2 })
  })

  it('без оценок средний балл пустой, полнота нулевая, если есть ученики и предметы', () => {
    const report = buildDirectorReport({
      groups: [groups[0]],
      subjectsByGroup: new Map([['g1', [{ id: 'math', name: 'Математика' }]]]),
      schoolSubjects: [],
      grades: [],
    })
    expect(report.summary.average).toBeNull()
    expect(report.summary.completeness).toBe(0)
    expect(report.bestStudents).toEqual([])
    expect(report.worstGrades).toEqual([])
    expect(report.groups[0].lowest).toBeNull()
  })

  it('оценка выше 5 переключает шкалу на десятибалльную', () => {
    expect(gradeBand(5)).toBe('excellent')
    expect(gradeBand(2)).toBe('poor')
    expect(gradeBand(9)).toBe('excellent')
    expect(gradeBand(6)).toBe('satisfactory')
    const report = buildDirectorReport({
      groups: [],
      subjectsByGroup: new Map(),
      schoolSubjects: [],
      grades: [grade({ value: 9, studentId: 'a', groupId: 'g1' })],
    })
    expect(report.scale).toBe('ten')
    expect(report.summary.excellent).toBe(1)
  })
})
