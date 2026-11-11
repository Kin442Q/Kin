import { useRef, useState } from 'react'
import { App as AntdApp, Button, Progress } from 'antd'
import { CloseOutlined, FileOutlined, UploadOutlined } from '@ant-design/icons'

import { SP } from './sprout'
import {
  ACCEPT_ATTR,
  LIMITS_HINT,
  checkFile,
  formatSize,
  uploadErrorText,
  type StoredFileView,
} from '../api/filesApi'

interface Props {
  /** Загруженный файл. Подключается к Form.Item автоматически (value / onChange). */
  value?: StoredFileView | null
  onChange?: (file: StoredFileView | null) => void
  /** Как загружать: у материалов урока и библиотеки свои адреса. */
  upload: (file: File, onProgress: (percent: number) => void) => Promise<StoredFileView>
  disabled?: boolean
}

/**
 * Выбор и загрузка одного файла: проверка типа и размера до отправки,
 * полоса прогресса, имя и размер загруженного файла, кнопка «убрать».
 */
export default function FileUploadField({ value, onChange, upload, disabled }: Props) {
  const { message } = AntdApp.useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [percent, setPercent] = useState<number | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    const problem = checkFile(file)
    if (problem) {
      message.error(problem)
      return
    }
    setPercent(0)
    try {
      onChange?.(await upload(file, setPercent))
    } catch (e) {
      message.error(uploadErrorText(e))
    } finally {
      setPercent(null)
    }
  }

  const uploading = percent !== null

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        hidden
        data-testid="file-input"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = '' // чтобы тот же файл можно было выбрать снова
        }}
      />

      {value && !uploading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: SP.primaryGhost,
            marginBottom: 8,
          }}
        >
          <FileOutlined style={{ color: SP.primaryDeep }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value.name}
          </span>
          <span style={{ color: SP.muted, fontSize: 12, whiteSpace: 'nowrap' }}>{formatSize(value.size)}</span>
          <Button
            size="small"
            type="text"
            aria-label="Убрать файл"
            icon={<CloseOutlined />}
            disabled={disabled}
            onClick={() => onChange?.(null)}
          />
        </div>
      )}

      {uploading && <Progress percent={percent ?? 0} size="small" status="active" style={{ marginBottom: 8 }} />}

      <Button
        icon={<UploadOutlined />}
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {value ? 'Выбрать другой файл' : 'Выбрать файл'}
      </Button>
      <div style={{ color: SP.muted, fontSize: 12, marginTop: 6 }}>{LIMITS_HINT}</div>
    </div>
  )
}
