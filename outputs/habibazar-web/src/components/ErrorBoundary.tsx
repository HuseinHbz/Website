'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset)
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-3xl bg-danger-muted border border-danger/20">
            ⚠
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary mb-6 max-w-sm">
            {error.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={this.reset}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all duration-fast"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
