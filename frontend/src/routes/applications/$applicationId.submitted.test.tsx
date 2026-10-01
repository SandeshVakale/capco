import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import { SubmissionReceipt } from './$applicationId.submitted'

const applicationId = '00000000-0000-4000-8000-000000000123'

describe('submission receipt', () => {
  it('is a terminal, refreshable state that does not return to the draft journey', async () => {
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}`, () =>
        HttpResponse.json({
          data: {
            type: 'applicant-applications',
            id: applicationId,
            attributes: {
              status: 'submitted',
              submittedAt: '2026-10-01T16:00:00Z',
              receipt: {
                message: 'Your application was received',
                nextStep: 'The review team will review your application.',
              },
            },
          },
        }),
      ),
    )
    const router = createMemoryRouter(
      [
        {
          path: '/applications/:applicationId/submitted',
          element: <SubmissionReceipt applicationId={applicationId} />,
        },
      ],
      { initialEntries: [`/applications/${applicationId}/submitted`] },
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Application submitted' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Your application was received')).toBeVisible()
    expect(screen.getByText(/You can safely close this window/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'DONE' }),
    ).not.toBeInTheDocument()
  })
})
