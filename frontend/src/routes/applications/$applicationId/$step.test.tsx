import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { describe, expect, it } from 'vitest'

import { server } from '../../../test/server'

import { ApplicantApplicationStepRoute } from './$step'

const applicationId = '00000000-0000-4000-8000-000000000123'

function formDocument(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      type: 'applicant-application-forms',
      id: applicationId,
      attributes: {
        status: 'draft',
        currentStep: 'personal-details',
        steps: [
          { step: 'personal-details', state: 'current' },
          { step: 'identity-and-address', state: 'remaining' },
        ],
        answers: {},
        documentEvidence: { present: false },
        version: 0,
        ...overrides,
      },
    },
  }
}

function renderStep(step: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      {
        path: '/applications/:applicationId/:step',
        element: <RoutedStep />,
      },
      { path: '/sign-in', element: <p>Sign-in destination</p> },
    ],
    { initialEntries: [`/applications/${applicationId}/${step}`] },
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function RoutedStep() {
  const params = useParams()
  return (
    <ApplicantApplicationStepRoute
      applicationId={params.applicationId ?? ''}
      stepName={params.step ?? ''}
    />
  )
}

describe('Applicant application step', () => {
  it('populates every saved personal-details answer', async () => {
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}/form`, () =>
        HttpResponse.json(
          formDocument({
            answers: {
              name: 'Ada Lovelace',
              dateOfBirth: '1815-12-10',
              country: 'United Kingdom',
              nationality: 'British',
              email: 'ada@example.test',
              phone: '+44 20 0000 0000',
              consentConfirmed: true,
            },
            version: 4,
          }),
        ),
      ),
    )
    renderStep('personal-details')

    expect(await screen.findByLabelText('Name (required)')).toHaveValue(
      'Ada Lovelace',
    )
    expect(screen.getByLabelText('Date of birth (required)')).toHaveValue(
      '1815-12-10',
    )
    expect(screen.getByLabelText('Country (required)')).toHaveValue(
      'United Kingdom',
    )
    expect(screen.getByLabelText('Nationality (required)')).toHaveValue(
      'British',
    )
    expect(screen.getByLabelText('Email (required)')).toHaveValue(
      'ada@example.test',
    )
    expect(screen.getByLabelText('Phone (required)')).toHaveValue(
      '+44 20 0000 0000',
    )
    expect(
      screen.getByRole('checkbox', {
        name: 'I confirm these details are accurate and belong to me.',
      }),
    ).toBeChecked()
  })

  it('populates identity answers and communicates existing evidence', async () => {
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}/form`, () =>
        HttpResponse.json(
          formDocument({
            currentStep: 'identity-and-address',
            steps: [
              { step: 'personal-details', state: 'complete' },
              { step: 'identity-and-address', state: 'current' },
            ],
            answers: {
              documentType: 'Passport',
              documentNumber: 'AB123456',
              documentCountry: 'United Kingdom',
              expiry: '2030-12-10',
              street: '12 Computing Lane',
              city: 'London',
              postal: 'SW1A 1AA',
              residentialCountry: 'United Kingdom',
            },
            documentEvidence: { present: true },
          }),
        ),
      ),
    )
    renderStep('identity-and-address')

    expect(
      await screen.findByLabelText('Document type (required)'),
    ).toHaveValue('Passport')
    expect(screen.getByLabelText('Document number (required)')).toHaveValue(
      'AB123456',
    )
    expect(screen.getByLabelText('Street (required)')).toHaveValue(
      '12 Computing Lane',
    )
    expect(screen.getByLabelText('City (required)')).toHaveValue('London')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Document evidence already uploaded.',
    )
    expect(screen.queryByLabelText(/Document evidence/)).not.toBeInTheDocument()
  })

  it('recovers from a temporary loading error', async () => {
    let requests = 0
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}/form`, () => {
        requests++
        return requests === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(formDocument({ answers: { name: 'Saved name' } }))
      }),
    )
    const user = userEvent.setup()
    renderStep('personal-details')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your saved application could not be loaded. Try again.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByLabelText('Name (required)')).toHaveValue(
      'Saved name',
    )
    expect(requests).toBe(2)
  })

  it('saves confirmed answers before navigating to the next step', async () => {
    let patchRequests = 0
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}/form`, () =>
        HttpResponse.json(formDocument()),
      ),
      http.patch(
        `/api/v1/applicant-applications/${applicationId}/form`,
        async ({ request }) => {
          patchRequests++
          const document = (await request.json()) as {
            data: { attributes: { answers: Record<string, unknown> } }
          }
          return HttpResponse.json(
            formDocument({
              currentStep: 'identity-and-address',
              steps: [
                { step: 'personal-details', state: 'complete' },
                { step: 'identity-and-address', state: 'current' },
              ],
              answers: document.data.attributes.answers,
              version: 1,
            }),
          )
        },
      ),
    )
    const user = userEvent.setup()
    renderStep('personal-details')

    await user.type(await screen.findByLabelText('Name (required)'), 'Ada')
    await user.type(
      screen.getByLabelText('Date of birth (required)'),
      '1815-12-10',
    )
    await user.type(screen.getByLabelText('Country (required)'), 'UK')
    await user.type(screen.getByLabelText('Nationality (required)'), 'British')
    await user.type(
      screen.getByLabelText('Email (required)'),
      'ada@example.test',
    )
    await user.type(screen.getByLabelText('Phone (required)'), '+442000000000')
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I confirm these details are accurate and belong to me.',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect(
      await screen.findByRole('heading', { name: 'Identity and address' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Your progress was saved.')).toBeInTheDocument()
    expect(patchRequests).toBe(1)
  })

  it('preserves entered answers after a failed save and permits retry', async () => {
    let patchRequests = 0
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}/form`, () =>
        HttpResponse.json(
          formDocument({
            answers: {
              name: 'Ada',
              dateOfBirth: '1815-12-10',
              country: 'UK',
              nationality: 'British',
              email: 'ada@example.test',
              phone: '+442000000000',
              consentConfirmed: true,
            },
          }),
        ),
      ),
      http.patch(`/api/v1/applicant-applications/${applicationId}/form`, () => {
        patchRequests++
        return patchRequests === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(
              formDocument({
                currentStep: 'identity-and-address',
                version: 1,
              }),
            )
      }),
    )
    const user = userEvent.setup()
    renderStep('personal-details')

    const name = await screen.findByLabelText('Name (required)')
    await user.clear(name)
    await user.type(name, 'Ada Byron')
    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your answers could not be saved. Try again.',
    )
    expect(name).toHaveValue('Ada Byron')

    await user.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(
      await screen.findByRole('heading', { name: 'Identity and address' }),
    ).toBeInTheDocument()
    expect(patchRequests).toBe(2)
  })

  it('refreshes a stale version without replacing local edits', async () => {
    let getRequests = 0
    const submittedVersions: number[] = []
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}/form`, () => {
        getRequests++
        return HttpResponse.json(
          formDocument({
            answers: {
              name: 'Server value',
              dateOfBirth: '1815-12-10',
              country: 'UK',
              nationality: 'British',
              email: 'ada@example.test',
              phone: '+442000000000',
              consentConfirmed: true,
            },
            version: getRequests === 1 ? 2 : 3,
          }),
        )
      }),
      http.patch(
        `/api/v1/applicant-applications/${applicationId}/form`,
        async ({ request }) => {
          const document = (await request.json()) as {
            data: { attributes: { version: number } }
          }
          submittedVersions.push(document.data.attributes.version)
          return submittedVersions.length === 1
            ? new HttpResponse(null, { status: 409 })
            : HttpResponse.json(
                formDocument({
                  currentStep: 'identity-and-address',
                  version: 4,
                }),
              )
        },
      ),
    )
    const user = userEvent.setup()
    renderStep('personal-details')

    const name = await screen.findByLabelText('Name (required)')
    await user.clear(name)
    await user.type(name, 'Unsaved local edit')
    await user.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This form changed in another session.',
    )

    await user.click(
      screen.getByRole('button', { name: 'Refresh form version' }),
    )
    expect(screen.getByLabelText('Name (required)')).toHaveValue(
      'Unsaved local edit',
    )
    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect(submittedVersions).toEqual([2, 3])
  })
})
