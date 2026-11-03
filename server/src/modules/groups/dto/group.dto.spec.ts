import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { CreateGroupDto } from './group.dto'

const check = (plain: Record<string, unknown>) =>
  validate(plainToInstance(CreateGroupDto, plain), { whitelist: true, forbidNonWhitelisted: true })

describe('CreateGroupDto', () => {
  const base = { name: '5А', ageRange: '10–11 лет', color: '#6366f1' }

  it('принимает группу без monthlyFee/fixedMonthlyExpense (разделы «Оплата»/«Расходы» выключены)', async () => {
    expect(await check(base)).toHaveLength(0)
  })

  it('принимает группу с оплатой и расходами', async () => {
    expect(await check({ ...base, monthlyFee: 1200, fixedMonthlyExpense: 6000 })).toHaveLength(0)
  })

  it('по-прежнему отклоняет отрицательную или нечисловую плату', async () => {
    expect(await check({ ...base, monthlyFee: -1 })).not.toHaveLength(0)
    expect(await check({ ...base, fixedMonthlyExpense: 'много' })).not.toHaveLength(0)
  })

  it('name и color остаются обязательными', async () => {
    expect(await check({ ageRange: '5–6 лет', color: '#fff' })).not.toHaveLength(0)
    expect(await check({ name: '5А', ageRange: '5–6 лет' })).not.toHaveLength(0)
  })

  it('возрастная категория необязательна (школа), но если задана — строка', async () => {
    expect(await check({ name: '5А', color: '#fff' })).toHaveLength(0)
    expect(await check({ name: '5А', color: '#fff', ageRange: 11 })).not.toHaveLength(0)
  })

  it('homeroomTeacherId: строка или null', async () => {
    expect(await check({ ...base, homeroomTeacherId: 't1' })).toHaveLength(0)
    expect(await check({ ...base, homeroomTeacherId: null })).toHaveLength(0)
    expect(await check({ ...base, homeroomTeacherId: 5 })).not.toHaveLength(0)
  })
})
