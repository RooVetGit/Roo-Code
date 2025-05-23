import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Mock console.error
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

const ProblemChild = () => {
  throw new Error('Test error');
};

const GoodChild = () => <div>All good!</div>;

describe('ErrorBoundary', () => {
  beforeEach(() => {
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  it('should catch errors and render fallback UI', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    // Check if the error message from the child is displayed (optional, based on ErrorBoundary impl)
    expect(screen.getByText(/Test error/i)).toBeInTheDocument();
    // Check if console.error was called
    expect(mockConsoleError).toHaveBeenCalledTimes(1);
  });

  it('should render children when there are no errors', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('All good!')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('should display error details when an error occurs', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    
    const detailsElement = screen.getByText('Error: Test error');
    expect(detailsElement).toBeInTheDocument();
    // Check for stack trace (presence of 'at ProblemChild' or similar)
    // Note: The exact stack trace might vary, so a partial match is safer.
    expect(screen.getByText(/at ProblemChild/i)).toBeInTheDocument();
  });
});
