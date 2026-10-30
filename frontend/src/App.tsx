import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Layout } from '@/components/Layout'
import { SimulationProvider } from '@/components/SimulationProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NewRecallPage } from '@/pages/NewRecallPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <NewRecallPage /> },
      // Loaded on demand: the dashboard pulls in Recharts, which is most of the bundle.
      {
        path: 'history',
        lazy: async () => ({ Component: (await import('@/pages/HistoryPage')).HistoryPage }),
      },
      {
        path: 'recalls/:id',
        lazy: async () => ({ Component: (await import('@/pages/RecallDetailPage')).RecallDetailPage }),
      },
      {
        path: 'explorer',
        lazy: async () => ({ Component: (await import('@/pages/ExplorerPage')).ExplorerPage }),
      },
      {
        path: 'dashboard',
        lazy: async () => ({ Component: (await import('@/pages/DashboardPage')).DashboardPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SimulationProvider>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </SimulationProvider>
    </QueryClientProvider>
  )
}
