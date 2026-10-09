import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App'

// The accountant looks at this all day: one calm accent colour, softer corners and slightly
// larger small text than Mantine's defaults (most of the UI uses the xs and sm sizes).
const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  fontSizes: { xs: '0.8125rem', sm: '0.9375rem' },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
)
