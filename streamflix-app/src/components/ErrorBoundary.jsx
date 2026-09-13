import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('StreamFlix crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state">
          <h2>Something went wrong</h2>
          <p>Please refresh the page. If the problem continues, check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
