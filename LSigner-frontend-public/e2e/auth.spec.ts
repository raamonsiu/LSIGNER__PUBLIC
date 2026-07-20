import { test, expect, type Page } from '@playwright/test';

const LOCALE_COOKIE = 'locale';

async function setLocale(page: Page, locale: string) {
  await page.evaluate(
    ({ name, value }: { name: string; value: string }) => {
      document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
    },
    { name: LOCALE_COOKIE, value: locale },
  );
}

test.describe('Authentication flows', () => {
  test.beforeEach(async ({ page }) => {
    // Default to Spanish for backward compatibility
    await page.goto('/login', { waitUntil: 'networkidle' });
    await setLocale(page, 'es');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login', { waitUntil: 'networkidle' });
  });

  test('login page renders correctly', async ({ page }) => {
    await expect(page.getByAltText('LSigner')).toBeVisible();
    await expect(page.getByText('LSigner', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /iniciar sesión/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /iniciar sesión/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continuar con google/i }),
    ).toBeVisible();
    await expect(page.getByText(/regístrate/i)).toBeVisible();
  });

  test('shows validation errors on empty form submission', async ({ page }) => {
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page.getByText(/el email es obligatorio/i)).toBeVisible();
    await expect(
      page.getByText(/la contraseña es obligatoria/i),
    ).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.getByLabel(/^correo electrónico$/i).fill('not-an-email');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page.getByText(/introduce un email válido/i)).toBeVisible();
  });

  test('redirects unauthenticated user to login on protected route', async ({
    page,
  }) => {
    await page.goto('/');

    await page.waitForURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: /iniciar sesión/i }),
    ).toBeVisible();
  });

  test('shows expired session message', async ({ page }) => {
    await page.goto('/login?reason=expired');

    await expect(
      page.getByText(/tu sesión ha caducado/i),
    ).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
        }),
      });
    });
    await page.route('**/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          patient_id: 'e2e-test-user',
          name: 'E2E',
          last_name: 'Test',
          country: 'Spain',
          national_id: null,
          passport: null,
          email: 'test@example.com',
          phone_number: '+34600000000',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        }),
      });
    });

    await page.getByLabel(/^correo electrónico$/i).fill('test@example.com');
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('password123');

    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page).toHaveURL('/');
  });

  test('failed login shows error message for wrong credentials', async ({
    page,
  }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid credentials',
          path: '/auth/login',
          timestamp: '2026-01-01T00:00:00.000Z',
          requestId: 'e2e-req',
        }),
      });
    });

    await page.getByLabel(/^correo electrónico$/i).fill('wrong@example.com');
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('wrongpassword');

    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(
      page.getByText(/credenciales incorrectas/i),
    ).toBeVisible();
  });

  test('shows backend validation errors on 400 response', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 400,
          error: 'Bad Request',
          message: ['email is required', 'password is required'],
          path: '/auth/login',
          timestamp: '2026-01-01T00:00:00.000Z',
          requestId: 'e2e-req',
        }),
      });
    });

    await page.getByLabel(/^correo electrónico$/i).fill('test@example.com');
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('secret123');

    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(
      page.getByText(/email is required · password is required/i),
    ).toBeVisible();
  });

  test('register page renders and links to login', async ({ page }) => {
    await page.goto('/register');

    await expect(
      page.getByRole('heading', { name: /crear cuenta/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /crear cuenta/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continuar con google/i }),
    ).toBeVisible();

    await page.getByText(/inicia sesión/i).click();
    await page.waitForURL(/\/login/);
  });
});

test.describe('Multilanguage — English', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await setLocale(page, 'en');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login', { waitUntil: 'networkidle' });
  });

  test('login page shows English text', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /sign in/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /sign in/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toBeVisible();
    await expect(page.getByText(/sign up/i)).toBeVisible();
  });

  test('register page shows English text', async ({ page }) => {
    await page.goto('/register');

    await expect(
      page.getByRole('heading', { name: /create account/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create account/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toBeVisible();
  });

  test('shows English validation errors', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });
});

test.describe('Multilanguage — Català', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await setLocale(page, 'ca');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login', { waitUntil: 'networkidle' });
  });

  test('login page shows Catalan text', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /iniciar sessió/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /iniciar sessió/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continua amb google/i }),
    ).toBeVisible();
    await expect(page.getByText(/registra't/i)).toBeVisible();
  });

  test('register page shows Catalan text', async ({ page }) => {
    await page.goto('/register');

    await expect(
      page.getByRole('heading', { name: /crear compte/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /crear compte/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continua amb google/i }),
    ).toBeVisible();
  });
});
