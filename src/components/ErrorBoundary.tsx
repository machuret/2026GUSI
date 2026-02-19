"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mb-3 h-10 w-10 text-red-400" />
          <p className="mb-1 font-semibold text-red-800">Something went wrong</p>
          <p className="mb-5 text-sm text-red-600">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
