import { describe, it, expect } from 'vitest'
import { calcGroupFinances } from './finance'
import type {
  Group,
  Child,
  Payment,
  Expense,
  ExtraIncome,
  AttendanceRecord,
} from '../types'

const group: Group = {
  id: 'g1',
  name: 'Солнышко',
  ageRange: '3-4',
  monthlyFee: 1000,
  fixedMonthlyExpense: 2000,
  color: '#fff',
  createdAt: '',
}

const child = (id: string, groupId = 'g1'): Child => ({
  id,
  firstName: 'N',
  lastName: 'L',
  birthDate: '2022-01-01',
  gender: 'male',
  groupId,
  createdAt: '',
})

const payment = (
  childId: string,
  amount: number,
  paid: boolean,
): Payment => ({
  id: 'p-' + childId,
  childId,
  amount,
  month: '2026-05',
  paid,
  createdAt: '',
})

describe('calcGroupFinances', () => {
  it('считает доход из оплаченных платежей', () => {
    const res = calcGroupFinances({
      groups: [group],
      children: [child('c1'), child('c2')],
      payments: [payment('c1', 1000, true), payment('c2', 1000, false)],
      expenses: [],
      extraIncome: [],
      attendance: [],
      month: '2026-05',
    })

    expect(res).toHaveLength(1)
    // Доход = только paid платежи = 1000
    expect(res[0].income).toBe(1000)
  })

  it('считает количество должников', () => {
    const res = calcGroupFinances({
      groups: [group],
      children: [child('c1'), child('c2'), child('c3')],
      payments: [
        payment('c1', 1000, true),
        payment('c2', 1000, false),
        payment('c3', 1000, false),
      ],
      expenses: [],
      extraIncome: [],
      attendance: [],
      month: '2026-05',
    })

    expect(res[0].paidCount).toBe(1)
    expect(res[0].debtorsCount).toBe(2)
    expect(res[0].childrenCount).toBe(3)
  })

  it('добавляет extraIncome к доходу', () => {
    const extra: ExtraIncome = {
      id: 'e1',
      title: 'Кружок',
      amount: 500,
      month: '2026-05',
      groupId: 'g1',
      createdAt: '',
    }

    const res = calcGroupFinances({
      groups: [group],
      children: [child('c1')],
      payments: [payment('c1', 1000, true)],
      expenses: [],
      extraIncome: [extra],
      attendance: [],
      month: '2026-05',
    })

    expect(res[0].income).toBe(1500)
  })

  it('включает прямые расходы группы', () => {
    const exp: Expense = {
      id: 'x1',
      category: 'Питание',
      description: 'Молоко',
      amount: 300,
      month: '2026-05',
      groupId: 'g1',
      createdAt: '',
    }

    const res = calcGroupFinances({
      groups: [group],
      children: [child('c1')],
      payments: [],
      expenses: [exp],
      extraIncome: [],
      attendance: [],
      month: '2026-05',
    })

    // Прямые расходы 300 + fixedMonthlyExpense 2000 = 2300
    expect(res[0].expenses).toBe(2300)
  })

  it('распределяет общие расходы пропорционально детям', () => {
    const commonExp: Expense = {
      id: 'cx1',
      category: 'Аренда помещения',
      description: 'Аренда',
      amount: 1000,
      month: '2026-05',
      createdAt: '',
      // groupId undefined → общий
    }

    const res = calcGroupFinances({
      groups: [group, { ...group, id: 'g2', name: 'Радуга' }],
      children: [
        child('c1', 'g1'),
        child('c2', 'g1'),
        child('c3', 'g2'),
      ],
      payments: [],
      expenses: [commonExp],
      extraIncome: [],
      attendance: [],
      month: '2026-05',
    })

    // g1: 2 из 3 детей → 666.67 от общих 1000 + 2000 fixed = ~2666.67
    // g2: 1 из 3 детей → 333.33 от общих 1000 + 2000 fixed = ~2333.33
    expect(Math.round(res[0].expenses)).toBe(2667)
    expect(Math.round(res[1].expenses)).toBe(2333)
  })

  it('считает прибыль и маржу', () => {
    const res = calcGroupFinances({
      groups: [group],
      children: [child('c1'), child('c2')],
      payments: [
        payment('c1', 5000, true),
        payment('c2', 5000, true),
      ],
      expenses: [],
      extraIncome: [],
      attendance: [],
      month: '2026-05',
    })

    // income=10000, expenses=2000 (fixed) → profit=8000, margin=0.8
    expect(res[0].income).toBe(10000)
    expect(res[0].expenses).toBe(2000)
    expect(res[0].profit).toBe(8000)
    expect(res[0].margin).toBeCloseTo(0.8, 2)
  })

  it('attendanceRate считает % присутствия', () => {
    const a: AttendanceRecord[] = [
      {
        id: '1',
        childId: 'c1',
        date: '2026-05-01',
        status: 'present',
      },
      {
        id: '2',
        childId: 'c1',
        date: '2026-05-02',
        status: 'absent',
      },
      {
        id: '3',
        childId: 'c1',
        date: '2026-05-03',
        status: 'present',
      },
    ]

    const res = calcGroupFinances({
      groups: [group],
      children: [child('c1')],
      payments: [],
      expenses: [],
      extraIncome: [],
      attendance: a,
      month: '2026-05',
    })

    // 2 из 3 = 0.66...
    expect(res[0].attendanceRate).toBeCloseTo(0.666, 2)
  })

  it('margin = 0 если income = 0', () => {
    const res = calcGroupFinances({
      groups: [group],
      children: [child('c1')],
      payments: [],
      expenses: [],
      extraIncome: [],
      attendance: [],
      month: '2026-05',
    })

    expect(res[0].income).toBe(0)
    expect(res[0].margin).toBe(0)
  })
})
