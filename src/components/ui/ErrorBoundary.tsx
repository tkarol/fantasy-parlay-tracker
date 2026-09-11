import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a render error in one part of the app from blanking the whole page,
 * which is what happened before: any thrown error left a white screen with
 * nothing but a console message.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-content-center bg-surface-2 px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-12 w-12 place-content-center rounded-2xl bg-rose-500/10 text-xl">
            ⚠
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink">This page hit an error</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {error.message || "An unexpected error occurred."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button variant="primary" onClick={() => window.location.assign("/")}>
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
