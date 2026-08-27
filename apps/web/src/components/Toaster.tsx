import { useTheme } from '@/theme'
import type { CSSProperties } from 'react'
import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--ink)',
          '--normal-border': 'var(--hairline)',
        } as CSSProperties
      }
    />
  )
}
