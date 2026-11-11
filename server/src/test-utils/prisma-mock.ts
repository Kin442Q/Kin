/// <reference types="jest" />
/**
 * Минимальный мок PrismaService для unit-тестов сервисов.
 * Все методы — jest.fn(), можно настраивать через mockResolvedValue.
 */

import type { PrismaService } from '../infrastructure/prisma/prisma.service'

type AnyFn = jest.Mock<any, any>

interface MockModel {
  findUnique: AnyFn
  findUniqueOrThrow: AnyFn
  findFirst: AnyFn
  findFirstOrThrow: AnyFn
  findMany: AnyFn
  create: AnyFn
  createMany: AnyFn
  update: AnyFn
  updateMany: AnyFn
  upsert: AnyFn
  delete: AnyFn
  deleteMany: AnyFn
  count: AnyFn
  aggregate: AnyFn
  groupBy: AnyFn
}

function model(): MockModel {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  }
}

export function createPrismaMock() {
  const $transaction = jest.fn().mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') {
      return fn(mock)
    }
    return Promise.all(fn)
  })

  const mock = {
    user: model(),
    kindergarten: model(),
    group: model(),
    student: model(),
    payment: model(),
    expense: model(),
    extraIncome: model(),
    attendance: model(),
    scheduleItem: model(),
    staff: model(),
    menuItem: model(),
    phoneChatLink: model(),
    refreshToken: model(),
    passwordToken: model(),
    notification: model(),
    auditLog: model(),
    salary: model(),
    monthlyReport: model(),
    conversation: model(),
    message: model(),
    kindergartenFeature: model(),
    homework: model(),
    homeworkSubmission: model(),
    grade: model(),
    diaryEntry: model(),
    kidNote: model(),
    subject: model(),
    libraryItem: model(),
    region: model(),
    district: model(),
    viewerScope: model(),
    storedFile: model(),
    lessonMaterial: model(),
    examTrack: model(),
    quiz: model(),
    quizQuestion: model(),
    quizAttempt: model(),
    gameScore: model(),
    $transaction,
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  }

  return mock as unknown as PrismaService & typeof mock
}

export type PrismaMock = ReturnType<typeof createPrismaMock>
