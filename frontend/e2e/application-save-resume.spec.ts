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

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(sessionEndpoint) &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Sign in' }).click()
  expect((await responsePromise).status()).toBe(201)
}

async function startApplication(page: Page): Promise<string> {
  await expect(
    page.getByRole('heading', { name: 'Start your KYC application' }),
  ).toBeVisible()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/applicant-applications') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Start application' }).click()
  expect((await responsePromise).status()).toBe(201)
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+\/personal-details$/)
  const match = page.url().match(/\/applications\/([^/]+)\/personal-details$/)
  expect(match?.[1]).toBeTruthy()
  return match![1]
}

async function fillPersonalDetails(page: Page, name: string): Promise<void> {
  await page.getByLabel('Name (required)').fill(name)
  await page.getByLabel('Date of birth (required)').fill('1990-06-15')
  await page
    .getByRole('combobox', { name: 'Country (required)' })
    .fill('France')
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Nationality (required)' })
    .fill('French')
  await page.getByRole('option', { name: 'French', exact: true }).click()
  await page.getByLabel('Email (required)').fill('applicant@example.test')
  await page.getByLabel('Phone (required)').fill('+33123456789')
  await page
    .getByRole('checkbox', {
      name: 'I confirm these details are accurate and belong to me.',
    })
    .check()
}

async function fillIdentityAndAddress(page: Page): Promise<void> {
  await page.getByLabel('Document type (required)').fill('Passport')
  await page.getByLabel('Document number (required)').fill('AB123456')
  await page
    .getByRole('combobox', { name: 'Document country (required)' })
    .fill('France')
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await page.getByLabel('Expiry (required)').fill('2030-12-31')
  await page.getByLabel('Street (required)').fill('1 Rue de Rivoli')
  await page.getByLabel('City (required)').fill('Paris')
  await page.getByLabel('Postal code (required)').fill('75001')
  await page
    .getByRole('combobox', { name: 'Residential country (required)' })
    .fill('France')
  await expect(
    page.getByRole('combobox', { name: 'Residential country (required)' }),
  ).toHaveValue('France')
}

async function uploadDocumentEvidence(
  page: Page,
  applicationId: string,
): Promise<void> {
  const status = await page.evaluate(async (id) => {
    const token = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('XSRF-TOKEN='))
      ?.slice('XSRF-TOKEN='.length)
    const bytes = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
      (character) => character.charCodeAt(0),
    )
    const data = new FormData()
    data.append('file', new Blob([bytes], { type: 'image/png' }), 'id.png')
    const response = await fetch(
      `/api/v1/applicant-applications/${id}/document-evidence`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {},
        body: data,
      },
    )
    return response.status
  }, applicationId)
  expect(status).toBe(201)
}

async function signOutThroughApi(page: Page): Promise<void> {
  const status = await page.evaluate(async () => {
    const token = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('XSRF-TOKEN='))
      ?.slice('XSRF-TOKEN='.length)
    const response = await fetch('/api/v1/applicant-sessions/current', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {},
    })
    return response.status
  })
  expect(status).toBe(204)
}

test.describe('Applicant save and resume', () => {
  test('restores server-saved answers after sign-out and later sign-in', async ({
    page,
    request,
  }) => {
    const email = 'save-resume-e2e@example.test'
    const savedName = 'Sandesh Resume Test'
    await seedApplicant(request, email)
    await signIn(page, email)
    const applicationId = await startApplication(page)

    await fillPersonalDetails(page, savedName)
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/v1/applicant-applications/${applicationId}/form`) &&
        response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save and continue' }).click()
    const saveResponse = await saveResponsePromise

    expect(saveResponse.status()).toBe(200)
    expect(saveResponse.request().headers()['accept']).toBe(
      'application/vnd.api+json',
    )
    expect(saveResponse.request().headers()['content-type']).toBe(
      'application/vnd.api+json',
    )
    expect(saveResponse.request().headers()['x-xsrf-token']).toBeTruthy()
    expect(saveResponse.request().postDataJSON()).toEqual({
      data: {
        type: 'applicant-application-forms',
        id: applicationId,
        attributes: {
          step: 'personal-details',
          answers: {
            name: savedName,
            dateOfBirth: '1990-06-15',
            country: 'France',
            nationality: 'French',
            email: 'applicant@example.test',
            phone: '+33123456789',
            consentConfirmed: true,
          },
          version: 0,
        },
      },
    })
    await expect(
      page.getByRole('heading', { name: 'Identity and address' }),
    ).toBeVisible()
    await expect(page.getByText('Your progress was saved.')).toBeVisible()

    await signOutThroughApi(page)
    await signIn(page, email)
    await expect(page).toHaveURL(
      new RegExp(`/applications/${applicationId}/identity-and-address$`),
    )

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByLabel('Name (required)')).toHaveValue(savedName)
    await expect(page.getByLabel('Date of birth (required)')).toHaveValue(
      '1990-06-15',
    )
    await expect(
      page.getByRole('combobox', { name: 'Country (required)' }),
    ).toHaveValue('France')
    await expect(
      page.getByRole('combobox', { name: 'Nationality (required)' }),
    ).toHaveValue('French')
    await expect(page.getByLabel('Email (required)')).toHaveValue(
      'applicant@example.test',
    )
    await expect(page.getByLabel('Phone (required)')).toHaveValue(
      '+33123456789',
    )
    await expect(
      page.getByRole('checkbox', {
        name: 'I confirm these details are accurate and belong to me.',
      }),
    ).toBeChecked()
  })

  test('retains answers and retries after a failed save', async ({
    page,
    request,
  }) => {
    const email = 'save-retry-e2e@example.test'
    const editedName = 'Retained Applicant Name'
    await seedApplicant(request, email)
    await signIn(page, email)
    await startApplication(page)
    await fillPersonalDetails(page, editedName)

    let patchAttempts = 0
    await page.route(
      '**/api/v1/applicant-applications/*/form',
      async (route) => {
        if (route.request().method() !== 'PATCH') {
          await route.continue()
          return
        }
        patchAttempts++
        if (patchAttempts === 1) {
          await route.fulfill({ status: 503 })
          return
        }
        await route.continue()
      },
    )

    await page.getByRole('button', { name: 'Save and continue' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'Your answers could not be saved. Try again.',
    )
    await expect(page.getByLabel('Name (required)')).toHaveValue(editedName)
    await expect(page.getByText('Your progress was saved.')).toHaveCount(0)

    await page.getByRole('button', { name: 'Save and continue' }).click()
    await expect(
      page.getByRole('heading', { name: 'Identity and address' }),
    ).toBeVisible()
    await expect(page.getByText('Your progress was saved.')).toBeVisible()
    expect(patchAttempts).toBe(2)
  })

  test('submits a complete application and does not offer it for resume', async ({
    page,
    request,
  }) => {
    const email = 'submission-e2e@example.test'
    await seedApplicant(request, email)
    await signIn(page, email)
    const applicationId = await startApplication(page)

    await fillPersonalDetails(page, 'Submission Applicant')
    await page.getByRole('button', { name: 'Save and continue' }).click()
    await expect(
      page.getByRole('heading', { name: 'Identity and address' }),
    ).toBeVisible()

    await fillIdentityAndAddress(page)
    await page.getByRole('button', { name: 'Save and review' }).click()
    await expect(
      page.getByRole('heading', { name: 'Review application' }),
    ).toBeVisible()

    await uploadDocumentEvidence(page, applicationId)
    await page.reload()
    await page
      .getByRole('checkbox', {
        name: 'I confirm the information is complete and accurate.',
      })
      .check()
    const responsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/v1/applicant-applications/${applicationId}`) &&
        response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Submit application' }).click()
    const response = await responsePromise

    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toMatchObject({
      data: {
        type: 'applicant-applications',
        id: applicationId,
        attributes: { status: 'submitted', confirmed: true },
      },
    })
    await expect(
      page.getByRole('heading', { name: 'Application submitted' }),
    ).toBeVisible()
    await expect(page.getByText('Your application was received')).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Application submitted' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'DONE' }).click()
    await expect(
      page.getByRole('heading', { name: 'Start your KYC application' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Resume application' }),
    ).toHaveCount(0)
  })
})
