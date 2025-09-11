// Comprehensive error boundary component for robust error handling

import { Ionicons } from '@expo/vector-icons';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface Props {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<ErrorBoundaryFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: (string | number | boolean | null | undefined)[];
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export interface ErrorBoundaryFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.error('[ErrorBoundary] Error caught:', errorId, error);
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    console.error('[ErrorBoundary] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('[ErrorBoundary] Error in custom error handler:', handlerError);
      }
    }

    // Report to crash analytics service (if implemented)
    if (__DEV__) {
      console.group('🚨 Error Boundary Report');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    } else {
      // In production, you might want to report to a service like Sentry
      // crashlytics().recordError(error);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when props change (if enabled)
    if (hasError && prevProps.resetKeys !== resetKeys && resetOnPropsChange) {
      if (resetKeys?.some((resetKey, idx) => prevProps.resetKeys?.[idx] !== resetKey)) {
        this.resetError();
      }
    }
  }

  resetError = () => {
    console.log('[ErrorBoundary] Resetting error state');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleRetry = () => {
    this.resetError();
    
    // Optional: Add a small delay to prevent rapid retries
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  };

  handleReportError = () => {
    const { error, errorId, errorInfo } = this.state;
    
    if (!error || !errorId) return;

    const errorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: 'React Native App',
    };

    // Copy error details to clipboard or show in alert for debugging
    const errorText = JSON.stringify(errorReport, null, 2);
    
    Alert.alert(
      'Error Report',
      `Error ID: ${errorId}\n\nThis error has been logged. You can share this ID with support for assistance.`,
      [
        { text: 'Copy Details', onPress: () => {
          // In a real app, you'd copy to clipboard here
          console.log('[ErrorBoundary] Error report:', errorText);
        }},
        { text: 'OK' }
      ]
    );
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallbackComponent: FallbackComponent } = this.props;

    if (hasError) {
      // Use custom fallback component if provided
      if (FallbackComponent && error && errorId) {
        return (
          <FallbackComponent
            error={error}
            errorInfo={errorInfo}
            resetError={this.resetError}
            errorId={errorId}
          />
        );
      }

      // Default error UI
      return (
        <View className="flex-1 bg-gray-50 justify-center items-center px-6">
          <View className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
            {/* Error Icon */}
            <View className="items-center mb-4">
              <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="warning" size={32} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-800 text-center">
                Oops! Something went wrong
              </Text>
            </View>

            {/* Error Message */}
            <View className="mb-6">
              <Text className="text-gray-600 text-center mb-3">
                The app encountered an unexpected error. Don't worry, your data is safe.
              </Text>
              
              {__DEV__ && error && (
                <ScrollView 
                  className="bg-gray-100 rounded-lg p-3 max-h-32"
                  showsVerticalScrollIndicator={false}
                >
                  <Text className="text-xs text-gray-700 font-mono">
                    {error.message}
                  </Text>
                </ScrollView>
              )}

              {errorId && (
                <Text className="text-xs text-gray-500 text-center mt-2">
                  Error ID: {errorId}
                </Text>
              )}
            </View>

            {/* Action Buttons */}
            <View className="space-y-3">
              <TouchableOpacity
                className="bg-blue-600 py-3 px-4 rounded-lg"
                onPress={this.handleRetry}
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-center">
                  Try Again
                </Text>
              </TouchableOpacity>

              {__DEV__ && (
                <TouchableOpacity
                  className="bg-gray-200 py-3 px-4 rounded-lg"
                  onPress={this.handleReportError}
                  activeOpacity={0.8}
                >
                  <Text className="text-gray-700 font-semibold text-center">
                    View Error Details
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Help Text */}
            <Text className="text-xs text-gray-500 text-center mt-4">
              If this problem persists, please restart the app or contact support.
            </Text>
          </View>
        </View>
      );
    }

    return children;
  }
}

// Custom fallback component for specific error types
export const NetworkErrorFallback: React.FC<ErrorBoundaryFallbackProps> = ({
  error,
  resetError,
  errorId,
}) => (
  <View className="flex-1 bg-gray-50 justify-center items-center px-6">
    <View className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
      <View className="items-center mb-4">
        <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center mb-3">
          <Ionicons name="wifi-outline" size={32} color="#F59E0B" />
        </View>
        <Text className="text-xl font-bold text-gray-800 text-center">
          Connection Problem
        </Text>
      </View>

      <Text className="text-gray-600 text-center mb-6">
        We're having trouble connecting to our servers. Please check your internet connection and try again.
      </Text>

      <TouchableOpacity
        className="bg-blue-600 py-3 px-4 rounded-lg"
        onPress={resetError}
        activeOpacity={0.8}
      >
        <Text className="text-white font-semibold text-center">
          Retry Connection
        </Text>
      </TouchableOpacity>

      <Text className="text-xs text-gray-500 text-center mt-4">
        Error ID: {errorId}
      </Text>
    </View>
  </View>
);

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default ErrorBoundary;
