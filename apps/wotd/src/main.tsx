import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import { bootTheme } from './features/theme/theme.ts'
import './styles/global.scss'

// Paint the theme before the first render so a dark-mode visitor never sees
// a light flash.
bootTheme()

const root = document.getElementById('root')
if (!root) throw new Error('missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
