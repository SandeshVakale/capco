import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import CurrentApplicationJourneyPage from './current'

const applicationId = '00000000-0000-4000-8000-000000000123'

function applicationDocument(
  currentStep: 'personal-details' | 'identity-and-address' = 'personal-details',
) {
  return {
    data: {
      type: 'applicant-applications',
      id: applicationId,
      attributes: {
        status: 'draft',
        currentStep,
        href: `/applications/${applicationId}/${currentStep}`,
        progress: [
          {
            step: 'personal-details',
            state: currentStep === 'personal-details' ? 'current' : 'complete',
          },
          {
            step: 'identity-and-address',
            state:
              currentStep === 'identity-and-address'
                ? 'current'
                : 'not-started',
          },
        ],
      },
    },
  }
}

function Location() {
  const location = useLocation()
  return <p>Destination: {location.pathname}</p>
}

function renderCurrentApplication() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      {
        path: '/applications/current',
        element: <CurrentApplicationJourneyPage />,
      },
      { path: '/applications/:applicationId/:step', element: <Location /> },
      { path: '/sign-in', element: <Location /> },
    ],
    { initialEntries: ['/applications/current'] },
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('current Applicant application journey', () => {
  it('loads an existing draft and resumes its API-provided current step', async () => {
    let createRequests = 0
    server.use(
      http.get('/api/v1/applicant-applications/current', () =>
        HttpResponse.json(applicationDocument('identity-and-address')),
      ),
      http.post('/api/v1/applicant-applications', () => {
        createRequests++
        return HttpResponse.json(applicationDocument(), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderCurrentApplication()

    expect(
      await screen.findByRole('heading', {
        name: 'Resume your KYC application',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Personal details').closest('li'),
    ).toHaveTextContent('Complete')
    await user.click(screen.getByRole('button', { name: 'Resume application' }))

    expect(
      await screen.findByText(
        `Destination: /applications/${applicationId}/identity-and-address`,
      ),
    ).toBeInTheDocument()
    expect(createRequests).toBe(0)
  })

  it('creates a draft only after the Applicant activates Start', async () => {
    let createRequests = 0
    server.use(
      http.get(
        '/api/v1/applicant-applications/current',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.post('/api/v1/applicant-applications', () => {
        createRequests++
        return HttpResponse.json(applicationDocument(), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderCurrentApplication()

    const start = await screen.findByRole('button', {
      name: 'Start application',
    })
    expect(createRequests).toBe(0)
    await user.click(start)

    expect(
      await screen.findByText(
        `Destination: /applications/${applicationId}/personal-details`,
      ),
    ).toBeInTheDocument()
    expect(createRequests).toBe(1)
  })

  it('offers sign-in recovery when the Applicant session has expired', async () => {
    server.use(
      http.get(
        '/api/v1/applicant-applications/current',
        () => new HttpResponse(null, { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    renderCurrentApplication()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your session has expired. Sign in to continue.',
    )
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Destination: /sign-in')).toBeInTheDocument()
  })

  it('lets the Applicant retry a temporary loading failure', async () => {
    let requests = 0
    server.use(
      http.get('/api/v1/applicant-applications/current', () => {
        requests++
        return requests === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(applicationDocument())
      }),
    )
    const user = userEvent.setup()
    renderCurrentApplication()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your application could not be loaded. Try again.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Resume your KYC application',
      }),
    ).toBeInTheDocument()
    expect(requests).toBe(2)
  })
})
