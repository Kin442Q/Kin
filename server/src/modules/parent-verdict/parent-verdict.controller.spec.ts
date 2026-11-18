import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import {
  GenerateVerdictDto, ParentVerdictController, PreviewVerdictQuery, SkipVerdictDto, UpdateVerdictConfigDto, UpdateVerdictTextDto,
} from './parent-verdict.controller'
import { ROLES_KEY } from '../../common/decorators/roles.decorator'
import { FEATURE_KEY } from '../../common/decorators/feature.decorator'

const proto = ParentVerdictController.prototype as unknown as Record<string, (...args: unknown[]) => unknown>
const rolesOf = (method: string) => Reflect.getMetadata(ROLES_KEY, proto[method]) as string[] | undefined
const pathOf = (method: string) => Reflect.getMetadata('path', proto[method]) as string
const httpOf = (method: string) => Reflect.getMetadata('method', proto[method]) as number

const valid = async <T extends object>(cls: new () => T, plain: object) => (await validate(plainToInstance(cls, plain))).length === 0

describe('ParentVerdictController: права', () => {
  it('на весь контроллер — только сотрудники школы; родителям, ученикам и ведомству нет', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ParentVerdictController) as string[]
    expect([...roles].sort()).toEqual(['ADMIN', 'SUPER_ADMIN', 'TEACHER'])
    expect(roles).not.toContain('PARENT')
    expect(roles).not.toContain('STUDENT')
    expect(roles).not.toContain('VIEWER')
  })

  it('нужны включённые разделы «Итоги месяца» и журнал оценок', () => {
    expect(Reflect.getMetadata(FEATURE_KEY, ParentVerdictController)).toEqual(['parent_verdict', 'grades'])
  })

  it('пороги школы меняет только директор: учитель (даже классный руководитель) — нет', () => {
    for (const method of ['getConfig', 'putConfig']) {
      expect([...(rolesOf(method) ?? [])].sort()).toEqual(['ADMIN', 'SUPER_ADMIN'])
    }
  })

  it('«config» и «preview» объявлены раньше «:id», иначе их примут за идентификатор вердикта', () => {
    const order = Object.getOwnPropertyNames(ParentVerdictController.prototype)
    const idRoutes = ['get', 'updateText', 'approve', 'reopen', 'skip', 'regenerate']
    for (const early of ['preview', 'getConfig', 'putConfig', 'generate', 'list']) {
      for (const late of idRoutes) expect(order.indexOf(early)).toBeLessThan(order.indexOf(late))
    }
    expect(pathOf('getConfig')).toBe('config')
    expect(pathOf('get')).toBe(':id')
  })

  it('переходы статуса — POST, правка текста — PATCH, чтение — GET (RequestMethod: GET=0, POST=1, PUT=2, PATCH=4)', () => {
    expect(httpOf('preview')).toBe(0)
    expect(httpOf('list')).toBe(0)
    expect(httpOf('get')).toBe(0)
    expect(httpOf('generate')).toBe(1)
    for (const m of ['approve', 'reopen', 'skip', 'regenerate']) expect(httpOf(m)).toBe(1)
    expect(httpOf('updateText')).toBe(4)
    expect(httpOf('putConfig')).toBe(2)
  })

  it('в контроллере нет ручки «опубликовать»: отправка родителю — следующий этап', () => {
    const names = Object.getOwnPropertyNames(ParentVerdictController.prototype)
    expect(names.filter((n) => /send|publish|deliver|notify/i.test(n))).toEqual([])
  })
})

describe('ParentVerdictController: проверка тел запросов', () => {
  it('просмотр и список: класс и месяц ГГГГ-ММ', async () => {
    expect(await valid(PreviewVerdictQuery, { groupId: 'g1', month: '2026-10' })).toBe(true)
    for (const month of ['2026-13', '2026-1', 'x', '']) {
      expect(await valid(PreviewVerdictQuery, { groupId: 'g1', month })).toBe(false)
    }
    expect(await valid(PreviewVerdictQuery, { groupId: '', month: '2026-10' })).toBe(false)
  })

  it('создание черновиков: класс и месяц ГГГГ-ММ', async () => {
    expect(await valid(GenerateVerdictDto, { groupId: 'g1', month: '2026-10' })).toBe(true)
    expect(await valid(GenerateVerdictDto, { groupId: 'g1', month: '2026-13' })).toBe(false)
    expect(await valid(GenerateVerdictDto, { groupId: '', month: '2026-10' })).toBe(false)
    expect(await valid(GenerateVerdictDto, { month: '2026-10' })).toBe(false)
  })

  it('правка текста: необязательные поля до 4000 знаков', async () => {
    expect(await valid(UpdateVerdictTextDto, {})).toBe(true)
    expect(await valid(UpdateVerdictTextDto, { textRu: 'a', textTg: 'б' })).toBe(true)
    expect(await valid(UpdateVerdictTextDto, { textRu: 'я'.repeat(4001) })).toBe(false)
    expect(await valid(UpdateVerdictTextDto, { textRu: 5 })).toBe(false)
  })

  it('пропуск: причина необязательна, до 500 знаков', async () => {
    expect(await valid(SkipVerdictDto, {})).toBe(true)
    expect(await valid(SkipVerdictDto, { reason: 'семья' })).toBe(true)
    expect(await valid(SkipVerdictDto, { reason: 'я'.repeat(501) })).toBe(false)
  })

  it('пороги: нужен объект', async () => {
    expect(await valid(UpdateVerdictConfigDto, { overrides: { weakAverage: 3.2 } })).toBe(true)
    expect(await valid(UpdateVerdictConfigDto, { overrides: {} })).toBe(true)
    expect(await valid(UpdateVerdictConfigDto, { overrides: 'x' })).toBe(false)
    expect(await valid(UpdateVerdictConfigDto, {})).toBe(false)
  })
})
