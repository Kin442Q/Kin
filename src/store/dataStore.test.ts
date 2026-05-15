import { describe, it, expect, beforeEach } from 'vitest'
import { useDataStore } from './dataStore'
import type { Group, Child, Payment } from '../types'

const sampleGroup: Group = {
  id: 'g1',
  name: 'Солнышко',
  ageRange: '3-4',
  monthlyFee: 1200,
  fixedMonthlyExpense: 5000,
  color: '#f59e0b',
  createdAt: '2026-01-01',
}

const sampleChild: Child = {
  id: 'c1',
  firstName: 'Айша',
  lastName: 'Каримова',
  birthDate: '2022-05-10',
  gender: 'female',
  groupId: 'g1',
  createdAt: '2026-01-01',
}

const samplePayment: Payment = {
  id: 'p1',
  childId: 'c1',
  month: '2026-05',
  amount: 1200,
  paid: false,
  createdAt: '2026-05-01',
}

describe('dataStore', () => {
  beforeEach(() => {
    useDataStore.getState().resetAll()
  })

  describe('groups', () => {
    it('начальное состояние — пустой массив', () => {
      expect(useDataStore.getState().groups).toEqual([])
    })

    it('setGroups заменяет весь массив', () => {
      useDataStore.getState().setGroups([sampleGroup])
      expect(useDataStore.getState().groups).toHaveLength(1)

      useDataStore.getState().setGroups([])
      expect(useDataStore.getState().groups).toEqual([])
    })

    it('upsertGroup добавляет новую', () => {
      useDataStore.getState().upsertGroup(sampleGroup)
      expect(useDataStore.getState().groups).toHaveLength(1)
      expect(useDataStore.getState().groups[0].id).toBe('g1')
    })

    it('upsertGroup обновляет существующую', () => {
      useDataStore.getState().upsertGroup(sampleGroup)
      useDataStore.getState().upsertGroup({
        ...sampleGroup,
        name: 'Обновлено',
      })
      expect(useDataStore.getState().groups).toHaveLength(1)
      expect(useDataStore.getState().groups[0].name).toBe('Обновлено')
    })

    it('deleteGroup удаляет и отвязывает детей', () => {
      useDataStore.getState().upsertGroup(sampleGroup)
      useDataStore.getState().upsertChild(sampleChild)

      useDataStore.getState().deleteGroup('g1')

      expect(useDataStore.getState().groups).toHaveLength(0)
      // Ребёнок остался, но groupId сброшен
      expect(useDataStore.getState().children[0].groupId).toBe('')
    })
  })

  describe('children', () => {
    it('setChildren заменяет массив', () => {
      useDataStore.getState().setChildren([sampleChild])
      expect(useDataStore.getState().children).toHaveLength(1)
    })

    it('upsertChild добавляет/обновляет', () => {
      useDataStore.getState().upsertChild(sampleChild)
      useDataStore.getState().upsertChild({
        ...sampleChild,
        firstName: 'Изменено',
      })
      expect(useDataStore.getState().children).toHaveLength(1)
      expect(useDataStore.getState().children[0].firstName).toBe('Изменено')
    })

    it('deleteChild удаляет связанные платежи и посещаемость', () => {
      useDataStore.getState().upsertChild(sampleChild)
      useDataStore.getState().upsertPayment(samplePayment)

      useDataStore.getState().deleteChild('c1')

      expect(useDataStore.getState().children).toHaveLength(0)
      expect(useDataStore.getState().payments).toHaveLength(0)
    })
  })

  describe('resetAll', () => {
    it('очищает все коллекции', () => {
      useDataStore.getState().upsertGroup(sampleGroup)
      useDataStore.getState().upsertChild(sampleChild)
      useDataStore.getState().upsertPayment(samplePayment)

      useDataStore.getState().resetAll()

      expect(useDataStore.getState().groups).toEqual([])
      expect(useDataStore.getState().children).toEqual([])
      expect(useDataStore.getState().payments).toEqual([])
    })
  })

  describe('notifications', () => {
    it('pushNotification добавляет в начало', () => {
      useDataStore.getState().pushNotification({
        title: 'Тест',
        description: 'Описание',
        type: 'info',
      })

      const list = useDataStore.getState().notifications
      expect(list).toHaveLength(1)
      expect(list[0].title).toBe('Тест')
      expect(list[0].read).toBe(false)
    })

    it('markAllNotificationsRead помечает все', () => {
      useDataStore.getState().pushNotification({
        title: 'Один',
        type: 'info',
      })
      useDataStore.getState().pushNotification({
        title: 'Два',
        type: 'info',
      })

      useDataStore.getState().markAllNotificationsRead()

      expect(
        useDataStore.getState().notifications.every((n) => n.read),
      ).toBe(true)
    })
  })
})
