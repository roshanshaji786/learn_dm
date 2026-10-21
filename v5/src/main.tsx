import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import '@fontsource/anek-malayalam/malayalam-500.css'
import '@fontsource/anek-malayalam/malayalam-700.css'
import './styles.css'
import App from './App'
import { applyTheme, parseHash, useStore } from './lib/store'

applyTheme(useStore.getState().theme)
document.documentElement.lang = useStore.getState().lang
// Admin is its own chunk; start fetching it straight away only on an admin deep link.
if (parseHash().view === 'admin') import('./views/Admin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
