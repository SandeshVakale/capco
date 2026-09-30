import { expect, test, type Page } from '@playwright/test'

const registrationPath = '/create-account'
const registrationEndpoint = '/api/v1/applicant-accounts'
const email = 'registration-e2e@example.test'
const password = 'Secure!1'

async function completeRegistrationForm(page: Page, emailAddress = email) {
  await page.getByLabel('Email address').fill(emailAddress)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
}

test.describe('Applicant registration', () => {
  test('validates fields accessibly before sending a request', async ({
    page,
  }) => {
    let registrationRequests = 0
    page.on('request', (request) => {
      if (request.url().endsWith(registrationEndpoint)) {
        registrationRequests++
      }
    })
    await page.goto(registrationPath)

    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'Check the highlighted fields and try again.',
    )
    const emailField = page.getByLabel('Email address')
    await expect(emailField).toBeFocused()
    await expect(emailField).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Enter an email address.')).toBeVisible()
    await expect(page.getByText('Enter a password.')).toBeVisible()
    await expect(page.getByText('Confirm your password.')).toBeVisible()
    expect(registrationRequests).toBe(0)
  })

  test('creates an account through the JSON:API contract', async ({
    context,
    page,
  }) => {
    await page.goto(registrationPath)
    await completeRegistrationForm(page)

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(registrationEndpoint) &&
        response.request().method() === 'POST',
    )
    await page.getByLabel('Confirm password').press('Enter')
    const response = await responsePromise

    expect(response.status()).toBe(201)
    const request = response.request()
    expect(request.headers()['accept']).toBe('application/vnd.api+json')
    expect(request.headers()['content-type']).toBe('application/vnd.api+json')
    expect(request.postDataJSON()).toEqual({
      data: {
        type: 'applicant-accounts',
        attributes: { email, password },
      },
    })

    await expect(
      page.getByRole('heading', { name: 'Account created' }),
    ).toBeVisible()
    await expect(page.getByRole('status')).toContainText(
      'Your account has been created.',
    )
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    )
    expect(await context.cookies()).toEqual([])
  })

  test('preserves input and offers recovery for a duplicate email', async ({
    page,
    request,
  }) => {
    const duplicateEmail = 'duplicate-registration-e2e@example.test'
    const seedResponse = await request.post(registrationEndpoint, {
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      data: {
        data: {
          type: 'applicant-accounts',
          attributes: { email: duplicateEmail, password },
        },
      },
    })
    expect(seedResponse.status()).toBe(201)

    await page.goto(registrationPath)
    await completeRegistrationForm(page, duplicateEmail)

    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith(registrationEndpoint),
    )
    await page.getByRole('button', { name: 'Create account' }).click()
    expect((await responsePromise).status()).toBe(409)

    await expect(page.getByRole('alert')).toHaveText(
      'An account already exists for this email address. Sign in or use another email address.',
    )
    await expect(page.getByLabel('Email address')).toHaveValue(duplicateEmail)
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(
      password,
    )

    await page.getByLabel('Email address').fill('another@example.test')
    await expect(page.getByRole('alert')).toBeHidden()
  })

  test('fits the registration workflow within a mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(registrationPath)

    await expect(
      page.getByRole('heading', { name: 'Create your account' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create account' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
