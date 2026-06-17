import { test, expect, type Page } from '@playwright/test'

/** Мокаем бэкенд: успешный логин админа + /me + пустые данные дашборда. */
async function mockBackend(page: Page) {
  // ВАЖНО: Playwright отдаёт приоритет ПОСЛЕДНЕМУ совпавшему route, поэтому
  // catch-all регистрируем ПЕРВЫМ, а конкретные эндпоинты — после него.
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      json: {
        accessToken: 'e2e-token',
        user: {
          id: 'admin-1',
          fullName: 'Тест Админ',
          email: 'admin@kindergarten.tj',
          role: 'ADMIN',
          kindergartenId: 'k1',
        },
      },
    }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'admin-1',
        institution: { id: 'k1', name: 'Садик', type: 'KINDERGARTEN' },
      },
    }),
  )
}

test.describe('Логин', () => {
  test('показывает три вкладки входа', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /Админ/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Воспитатель/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Родитель/ })).toBeVisible()
  })

  test('бренд Maktab на странице, нет «Запросить демо»', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Maktab').first()).toBeVisible()
    await expect(page.getByText(/Запросить демо/)).toHaveCount(0)
  })

  test('воспитатель — телефон, родитель — email', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: /Воспитатель/ }).click()
    await expect(page.getByPlaceholder('+992 90 123 45 67')).toBeVisible()

    await page.getByRole('button', { name: /Родитель/ }).click()
    await expect(page.getByPlaceholder('parent@kindergarten.tj')).toBeVisible()
  })

  test('успешный вход админа → редирект на дашборд', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.getByPlaceholder('admin@kindergarten.tj').fill('admin@kindergarten.tj')
    await page.getByPlaceholder('••••••••').fill('secret123')
    await page.getByRole('button', { name: /Войти/ }).click()

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 })
  })
})
