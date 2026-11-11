import { PartialType } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator'

export const LIBRARY_TYPES = ['BOOK', 'ARTICLE', 'VIDEO', 'AUDIO', 'LINK'] as const
export type LibraryType = (typeof LIBRARY_TYPES)[number]

export class CreateLibraryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @IsIn([...LIBRARY_TYPES])
  type!: LibraryType

  /**
   * Ссылка на материал. Только http/https; внутришкольные адреса без домена допустимы.
   * Нужна либо ссылка, либо загруженный файл (fileId).
   */
  @IsOptional()
  @ValidateIf((o) => o.url !== undefined && o.url !== null && o.url !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2000)
  url?: string | null

  /** id файла, загруженного через POST /library/upload. */
  @IsOptional()
  @IsString()
  fileId?: string | null

  @IsOptional()
  @IsString()
  subjectId?: string | null

  /** Параллель (5, 6…) или null — для всех классов. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  gradeNumber?: number | null
}

export class UpdateLibraryItemDto extends PartialType(CreateLibraryItemDto) {}
