import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './services/queries'
import { VaultProvider } from './vault/vault'
import App from './App'
import './styles.css'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <VaultProvider>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </VaultProvider>
    </QueryClientProvider>
  </StrictMode>,
)
