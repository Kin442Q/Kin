import { SetMetadata } from '@nestjs/common'

export const ALLOW_VIEWER_KEY = 'allowViewer'

export interface AllowViewerOptions {
  /**
   * Разрешить и запросы, меняющие данные (POST/PATCH/DELETE). Нужно только для /auth: выход, смена
   * пароля, обновление токена. Остальные ручки наблюдателя только читают.
   */
  write?: boolean
}

/**
 * Эту ручку может вызывать наблюдатель (роль VIEWER: министерство, районный отдел образования).
 * По умолчанию наблюдателю закрыто ВСЁ: пользователи с этой ролью не привязаны к школе, а во многих
 * местах «нет школы» означает «владелец платформы» — поэтому доступ открывается только явно
 * (см. ViewerDenyGuard). Ставить можно только на ручки, которые отдают сводки без личных данных.
 */
export const AllowViewer = (options: AllowViewerOptions = {}) =>
  SetMetadata(ALLOW_VIEWER_KEY, { write: options.write === true })
