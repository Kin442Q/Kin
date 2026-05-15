/**
 * Сопоставление русских названий позиций (UI) и enum бекенда.
 * 'Воспитатель' в UI — это User с role=TEACHER, не Staff.
 */

export type StaffPositionEnum =
  | 'TEACHER_ASSISTANT'
  | 'HEAD_MASTER'
  | 'METHODIST'
  | 'NURSE'
  | 'COOK'
  | 'PSYCHOLOGIST'
  | 'MUSIC_TEACHER'
  | 'GUARD'
  | 'CLEANER'
  | 'OTHER'

export const POSITION_TO_ENUM: Record<string, StaffPositionEnum> = {
  'Помощник воспитателя': 'TEACHER_ASSISTANT',
  Заведующий: 'HEAD_MASTER',
  Методист: 'METHODIST',
  Медсестра: 'NURSE',
  Повар: 'COOK',
  Психолог: 'PSYCHOLOGIST',
  'Музыкальный руководитель': 'MUSIC_TEACHER',
  Охранник: 'GUARD',
  Уборщик: 'CLEANER',
}

export const ENUM_TO_POSITION: Record<StaffPositionEnum, string> = {
  TEACHER_ASSISTANT: 'Помощник воспитателя',
  HEAD_MASTER: 'Заведующий',
  METHODIST: 'Методист',
  NURSE: 'Медсестра',
  COOK: 'Повар',
  PSYCHOLOGIST: 'Психолог',
  MUSIC_TEACHER: 'Музыкальный руководитель',
  GUARD: 'Охранник',
  CLEANER: 'Уборщик',
  OTHER: 'Прочее',
}

export function toBackendPosition(ru: string): StaffPositionEnum {
  return POSITION_TO_ENUM[ru] || 'OTHER'
}

export function toRussianPosition(en: string): string {
  return ENUM_TO_POSITION[en as StaffPositionEnum] || 'Прочее'
}
