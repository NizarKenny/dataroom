import { Button } from '@/components/ui/button'
import { d } from '@/lib/dictionary'
import { say } from '@/lib/i18n'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}

/**
 * A render that throws should not leave a blank page. React only offers this as a
 * class, which is why this one file is not a function component.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('render failed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">{say(d.common.wentWrong)}</h1>
          <p className="mx-auto mt-2 mb-4 max-w-[42ch] text-ink-muted">
            {say(d.common.couldNotDraw)}
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            {say(d.common.reload)}
          </Button>
        </div>
      </div>
    )
  }
}
