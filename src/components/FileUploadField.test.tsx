import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App as AntdApp } from 'antd'
import { useState } from 'react'

import FileUploadField from './FileUploadField'
import type { StoredFileView } from '../api/filesApi'

const MB = 1024 * 1024
const uploaded: StoredFileView = { id: 'f1', name: 'Учебник.pdf', size: 2 * MB, mime: 'application/pdf' }

/** Как в форме: значение хранит родитель, поле получает value / onChange. */
function Harness({ upload, onChange }: { upload: (f: File, p: (n: number) => void) => Promise<StoredFileView>; onChange?: (f: StoredFileView | null) => void }) {
  const [value, setValue] = useState<StoredFileView | null>(null)
  return (
    <AntdApp>
      <FileUploadField
        value={value}
        upload={upload}
        onChange={(f) => {
          setValue(f)
          onChange?.(f)
        }}
      />
    </AntdApp>
  )
}

const pick = (file: File) => {
  const input = screen.getByTestId('file-input') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

let upload: ReturnType<typeof vi.fn>
beforeEach(() => {
  upload = vi.fn()
})

describe('FileUploadField', () => {
  it('подходящий файл загружается, показываются имя и размер, можно убрать', async () => {
    upload.mockImplementation(async (_f: File, progress: (n: number) => void) => {
      progress(50)
      return uploaded
    })
    const onChange = vi.fn()
    render(<Harness upload={upload} onChange={onChange} />)

    pick(new File(['%PDF'], 'Учебник.pdf', { type: 'application/pdf' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(uploaded))
    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0][0].name).toBe('Учебник.pdf')
    expect(await screen.findByText('Учебник.pdf')).toBeTruthy()
    expect(screen.getByText('2 МБ')).toBeTruthy()
    expect(screen.getByText('Выбрать другой файл')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Убрать файл'))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('Выбрать файл')).toBeTruthy()
  })

  it('неподходящий тип и слишком большой файл отклоняются без отправки на сервер', async () => {
    const onChange = vi.fn()
    render(<Harness upload={upload} onChange={onChange} />)

    pick(new File(['MZ'], 'virus.exe'))
    expect(await screen.findByText(/не поддерживается/)).toBeTruthy()

    const big = new File(['x'], 'big.pdf')
    Object.defineProperty(big, 'size', { value: 21 * MB })
    pick(big)
    expect(await screen.findByText(/максимум 20 МБ/)).toBeTruthy()

    expect(upload).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ошибка сервера показывается понятным текстом, значение не меняется', async () => {
    upload.mockRejectedValue({ response: { status: 413, data: { message: 'File too large' } } })
    const onChange = vi.fn()
    render(<Harness upload={upload} onChange={onChange} />)

    pick(new File(['%PDF'], 'a.pdf'))

    expect(await screen.findByText(/Документы до 20 МБ, видео до 100 МБ/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
    // после ошибки снова можно выбрать файл
    expect((screen.getByText('Выбрать файл').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('подсказка с лимитами видна сразу', () => {
    render(<Harness upload={upload} />)
    expect(screen.getByText(/до 20 МБ, видео — до 100 МБ/)).toBeTruthy()
  })
})
