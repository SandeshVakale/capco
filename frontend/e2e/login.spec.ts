import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

const registrationEndpoint = '/api/v1/applicant-accounts'
const sessionEndpoint = '/api/v1/applicant-sessions'
const password = 'Secure!1'

async function seedApplicant(
  request: APIRequestContext,
  email: string,
): Promise<void> {
  const response = await request.post(registrationEndpoint, {
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    data: {
      data: {
        type: 'applicant-accounts',
        attributes: { email, password },
      },
    },
  })

  expect(response.status()).toBe(201)
}

async function completeSignInForm(
  page: Page,
  email: string,
  submittedPassword = password,
): Promise<void> {
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(submittedPassword)
}

test.describe('Applicant sign in', () => {
  test('validates credentials accessibly before sending a request', async ({
    page,
  }) => {
    let sessionRequests = 0
    page.on('request', (request) => {
      if (request.url().endsWith(sessionEndpoint)) {
        sessionRequests++
      }
    })
    await page.goto('/sign-in')

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'Check the highlighted fields and try again.',
    )
    const emailField = page.getByLabel('Email address')
    await expect(emailField).toBeFocused()
    await expect(emailField).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Enter your email address.')).toBeVisible()
    await expect(page.getByText('Enter your password.')).toBeVisible()
    expect(sessionRequests).toBe(0)
  })

  test('creates a session and follows the journey URL returned by the API', async ({
    context,
    page,
    request,
  }) => {
    const email = 'login-success-e2e@example.test'
    await seedApplicant(request, email)
    await page.goto(
      '/sign-in?returnTo=/applications/prototype/identity-and-address',
    )
    await completeSignInForm(page, email)

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(sessionEndpoint) &&
        response.request().method() === 'POST',
    )
    await page.getByLabel('Password').press('Enter')
    const response = await responsePromise

    expect(response.status()).toBe(201)
    const submittedRequest = response.request()
    expect(submittedRequest.headers()['accept']).toBe(
      'application/vnd.api+json',
    )
    expect(submittedRequest.headers()['content-type']).toBe(
      'application/vnd.api+json',
    )
    expect(submittedRequest.postDataJSON()).toEqual({
      data: {
        type: 'applicant-sessions',
        attributes: { email, password },
      },
    })

    await expect(page).toHaveURL(/\/applications\/current$/)
    await expect(
      page.getByRole('heading', { name: 'Start your KYC application' }),
    ).toBeVisible()

    const cookies = await context.cookies()
    const sessionCookie = cookies.find(
      (cookie) => cookie.name === '__Host-KYCSESSION',
    )
    const csrfCookie = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')
    expect(sessionCookie).toMatchObject({
      httpOnly: true,
      path: '/',
      secure: true,
    })
    expect(csrfCookie).toMatchObject({
      httpOnly: false,
      path: '/',
      secure: true,
    })
  })

  test('uses the same safe error and preserves email for invalid credentials', async ({
    page,
    request,
  }) => {
    const knownEmail = 'login-invalid-e2e@example.test'
    const unknownEmail = 'login-unknown-e2e@example.test'
    await seedApplicant(request, knownEmail)
    await page.goto('/sign-in')

    await completeSignInForm(page, knownEmail, 'Wrong!1')
    const knownResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith(sessionEndpoint),
    )
    await page.getByRole('button', { name: 'Sign in' }).click()
    expect((await knownResponsePromise).status()).toBe(401)

    const alert = page.getByRole('alert')
    await expect(alert).toHaveText('Invalid email or password.')
    await expect(page.getByLabel('Email address')).toHaveValue(knownEmail)
    await expect(page.getByLabel('Password')).toHaveValue('')

    await completeSignInForm(page, unknownEmail, 'Wrong!1')
    const unknownResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith(sessionEndpoint),
    )
    await page.getByRole('button', { name: 'Sign in' }).click()
    expect((await unknownResponsePromise).status()).toBe(401)

    await expect(alert).toHaveText('Invalid email or password.')
    await expect(page.getByLabel('Email address')).toHaveValue(unknownEmail)
    await expect(page.getByLabel('Password')).toHaveValue('')
  })

  test('fits the sign-in workflow within a mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/sign-in')

    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
