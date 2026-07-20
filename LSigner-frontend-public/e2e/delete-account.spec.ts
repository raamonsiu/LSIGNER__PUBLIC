import { test, expect, type Page } from '@playwright/test';

const LOCALE_COOKIE = 'locale';
const SESSION_KEY = 'lsigner_session';

async function setLocale(page: Page, locale: string) {
  await page.evaluate(
    ({ name, value }: { name: string; value: string }) => {
      document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
    },
    { name: LOCALE_COOKIE, value: locale },
  );
}

/**
 * Sets up all API mocks needed for a logged-in user session.
 */
async function mockApiRoutes(page: Page, userOverrides: Record<string, unknown> = {}) {
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
        ...userOverrides,
      }),
    });
  });
}

async function seedSession(page: Page) {
  await page.evaluate((key: string) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          patient_id: 'e2e-test-user',
          name: 'E2E',
          last_name: 'Test',
          email: 'test@example.com',
        },
        expiresAt: Date.now() + 3600_000,
      }),
    );
  }, SESSION_KEY);
}

test.describe('Delete Account Danger Zone', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Set up API route mocks (works on about:blank)
    await mockApiRoutes(page);
    // 2. Navigate first so we're on the right origin
    await page.goto('/settings', { waitUntil: 'networkidle' });
    // 3. Set locale cookie (needs a page on the target origin, not about:blank)
    await setLocale(page, 'es');
    // 4. Seed localStorage session (also needs the right origin)
    await seedSession(page);
    // 5. Reload with locale cookie + session
    await page.goto('/settings', { waitUntil: 'networkidle' });
  });

  test('shows Danger Zone section on Settings page', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });

    // Verify the Danger Zone section title is visible
    await expect(
      page.getByRole('heading', { name: 'Zona de Peligro' }),
    ).toBeVisible();

    // Verify the delete button is visible
    await expect(
      page.getByRole('button', { name: /eliminar cuenta/i }),
    ).toBeVisible();
  });

  test('opens confirmation modal when clicking delete button', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });

    // Click the delete button
    await page.getByRole('button', { name: /eliminar cuenta/i }).click();

    // Verify the modal is open with confirmation text
    await expect(
      page.getByText(/escribe/i),
    ).toBeVisible();
    await expect(
      page.getByText('confirmar'),
    ).toBeVisible();
  });

  test('keeps delete button disabled until correct keyword is typed', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });

    // Open the modal
    await page.getByRole('button', { name: /eliminar cuenta/i }).click();

    // The destructive button should be disabled initially
    const confirmButton = page.getByRole('button', { name: /eliminar cuenta definitivamente/i });
    await expect(confirmButton).toBeDisabled();

    // Type wrong keyword
    const textField = page.getByRole('textbox', { name: /confirmar/i });
    await textField.fill('cancelar');
    await expect(confirmButton).toBeDisabled();

    // Type correct keyword
    await textField.fill('confirmar');
    await expect(confirmButton).toBeEnabled();
  });

  test('successfully deletes account and redirects to login', async ({ page }) => {
    // Mock the delete endpoint
    await page.route('**/users/me/delete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Cuenta eliminada correctamente',
          cancelled_documents: 0,
          expired_recipient_lines: 0,
        }),
      });
    });

    await page.goto('/settings', { waitUntil: 'networkidle' });

    // Open the modal
    await page.getByRole('button', { name: /eliminar cuenta/i }).click();

    // Type the confirmation keyword
    await page.getByRole('textbox', { name: /confirmar/i }).fill('confirmar');

    // Click the destructive confirm button
    await page.getByRole('button', { name: /eliminar cuenta definitivamente/i }).click();

    // Wait for the snackbar/success message
    await expect(
      page.getByText(/cuenta eliminada correctamente/i),
    ).toBeVisible({ timeout: 5000 });

    // Verify redirect to /login after deletion
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('shows error snackbar when API call fails', async ({ page }) => {
    // Mock the delete endpoint to return a 500 error
    await page.route('**/users/me/delete', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Error interno',
        }),
      });
    });

    await page.goto('/settings', { waitUntil: 'networkidle' });

    // Open the modal
    await page.getByRole('button', { name: /eliminar cuenta/i }).click();

    // Type confirmation and click delete
    await page.getByRole('textbox', { name: /confirmar/i }).fill('confirmar');
    await page.getByRole('button', { name: /eliminar cuenta definitivamente/i }).click();

    // Verify error message is shown in the modal
    const modal = page.getByRole('dialog');
    await expect(
      modal.getByText(/error al eliminar/i),
    ).toBeVisible({ timeout: 5000 });

    // Should NOT redirect — user stays on settings
    await expect(page).toHaveURL(/\/settings/);
  });
});
