import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/outfit/latin-400.css'
import '@fontsource/outfit/latin-500.css'
import '@fontsource/outfit/latin-600.css'
import '@fontsource/outfit/latin-700.css'
import '@fontsource/outfit/latin-800.css'
import '@fontsource/outfit/latin-ext-400.css'
import '@fontsource/outfit/latin-ext-500.css'
import '@fontsource/outfit/latin-ext-600.css'
import '@fontsource/outfit/latin-ext-700.css'
import '@fontsource/outfit/latin-ext-800.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import '@fontsource/ibm-plex-mono/latin-ext-500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
