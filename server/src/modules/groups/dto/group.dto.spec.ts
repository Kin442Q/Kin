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

  it('name, ageRange и color остаются обязательными', async () => {
    expect(await check({ ageRange: '3–4 года', color: '#fff' })).not.toHaveLength(0)
    expect(await check({ name: 'Солнышко', color: '#fff' })).not.toHaveLength(0)
    expect(await check({ name: 'Солнышко', ageRange: '3–4 года' })).not.toHaveLength(0)
  })
})
