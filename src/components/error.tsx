import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    detailInfo?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    state: State = {
        hasError: false
    };

    static getDerivedStateFromError(_: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true , detailInfo: _};
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return <div>
                <h1>Sorry.. there was an error </h1>
                <p> {JSON.stringify(this.state.detailInfo?.name)}</p>
                <p> {JSON.stringify(this.state.detailInfo?.message)}</p>
                <p> {JSON.stringify(this.state.detailInfo?.stack)}</p>
            </div>;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
