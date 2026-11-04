import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

/** Что может выставить учитель. SUBMITTED («сделал») — только сам ученик. */
export const STAFF_STATUSES = ['DONE', 'PARTIAL', 'NOT_DONE'] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

export class SubmissionItemDto {
  @IsString()
  studentId!: string

  /** null — снять отметку (ДЗ снова «не отмечено»). */
  @ValidateIf((o: SubmissionItemDto) => o.status !== null)
  @IsIn([...STAFF_STATUSES])
  status!: StaffStatus | null

  /** Не передан — комментарий не меняется. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}

export class SetSubmissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SubmissionItemDto)
  items!: SubmissionItemDto[]
}

export class NotifyParentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  studentIds!: string[]

  /** Не указан — шаблон выбирается по статусу каждого ученика. */
  @IsOptional()
  @IsIn(['NOT_DONE', 'PARTIAL', 'REMINDER'])
  template?: 'NOT_DONE' | 'PARTIAL' | 'REMINDER'

  /** Комментарий учителя — добавляется в конец сообщения. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}
