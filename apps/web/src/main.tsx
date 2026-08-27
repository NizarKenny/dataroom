import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'
import { App } from './App'
import { SessionProvider } from './auth/session'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A data room is not a live feed. Refetching on every window focus makes
      // the table flicker for no new information.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <TooltipProvider delayDuration={200}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </TooltipProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
