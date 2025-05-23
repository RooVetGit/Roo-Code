import React from 'react';
import { render, screen, act } from '@testing-library/react';
import AppWithProviders from '../App'; // Assuming App is exported as AppWithProviders
import { useExtensionState } from '../context/ExtensionStateContext';
import { vscode } from '../utils/vscode';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TranslationProvider from '../i18n/TranslationContext';

// Mock vscode API
jest.mock('../utils/vscode', () => ({
  vscode: {
    postMessage: jest.fn(),
  },
}));

// Mock useExtensionState
jest.mock('../context/ExtensionStateContext', () => ({
  useExtensionState: jest.fn(),
  ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="extension-state-provider">{children}</div>,
}));


// Mock child components to simplify testing App.tsx's direct responsibilities
jest.mock('../components/welcome/WelcomeView', () => () => <div data-testid="welcome-view">Welcome View</div>);
jest.mock('../components/chat/ChatView', () => React.forwardRef((props: any, ref: any) => <div data-testid="chat-view" className={props.isHidden ? 'hidden' : ''}>Chat View</div>));
jest.mock('../components/history/HistoryView', () => () => <div data-testid="history-view">History View</div>);
jest.mock('../components/settings/SettingsView', () => React.forwardRef(() => <div data-testid="settings-view">Settings View</div>));
jest.mock('../components/prompts/PromptsView', () => () => <div data-testid="prompts-view">Prompts View</div>);
jest.mock('../components/mcp/McpView', () => () => <div data-testid="mcp-view">MCP View</div>);
jest.mock('../components/human-relay/HumanRelayDialog', () => () => <div data-testid="human-relay-dialog">Human Relay Dialog</div>);


const mockUseExtensionState = useExtensionState as jest.Mock;
const queryClient = new QueryClient();

// Wrapper component that includes the providers AppWithProviders would typically include
const TestAppWrapper = ({ children } : {children: React.ReactNode}) => (
    <ExtensionStateContextProvider>
        <TranslationProvider>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </TranslationProvider>
    </ExtensionStateContextProvider>
);


describe('App Loading and Timeout Logic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseExtensionState.mockClear();
    (vscode.postMessage as jest.Mock).mockClear();
    // Provide a default mock return value for all tests, can be overridden per test
    mockUseExtensionState.mockReturnValue({
        didHydrateState: false,
        showWelcome: false,
        shouldShowAnnouncement: false,
        telemetrySetting: 'off',
        telemetryKey: '',
        machineId: '',
        // Add any other state properties App.tsx might destructure
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should display loading indicator when didHydrateState is false', () => {
    render(<AppWithProviders />, { wrapper: TestAppWrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(vscode.postMessage).toHaveBeenCalledWith({ type: "webviewDidLaunch" });
  });

  it('should display main app content after didHydrateState becomes true (before timeout)', async () => {
    // Initial render with loading
    render(<AppWithProviders />, { wrapper: TestAppWrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Update state to hydrated
    mockUseExtensionState.mockReturnValue({
        didHydrateState: true,
        showWelcome: false,
        shouldShowAnnouncement: false,
        telemetrySetting: 'off',
        telemetryKey: '',
        machineId: '',
        tab: 'chat', // ensure a default tab is set for rendering main content
    });
    
    // Advance timers just enough to trigger useEffects but not timeout
    await act(async () => {
      // Re-render with the new mock value (simulating context update)
      // We need to re-render the whole AppWithProviders for the context change to propagate
      // In a real app, context consumers re-render automatically. Here we force it.
      // This requires AppWithProviders to be what we render, not App directly
      render(<AppWithProviders />, { wrapper: TestAppWrapper }); // Re-render the component with new mock
      jest.advanceTimersByTime(100); // process useEffects
    });
    
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    // Check for a component that's part of the main app view when not showing welcome
    expect(screen.getByTestId('chat-view')).toBeInTheDocument(); 
  });
  
  it('should display WelcomeView when showWelcome is true and didHydrate is true', async () => {
    mockUseExtensionState.mockReturnValue({
      didHydrateState: true,
      showWelcome: true,
      // ... other necessary states
    });

    render(<AppWithProviders />, { wrapper: TestAppWrapper });
    
    await act(async () => {
        jest.advanceTimersByTime(100); // process useEffects
    });

    expect(screen.getByTestId('welcome-view')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.queryByText(/The extension is taking longer than expected to load/)).not.toBeInTheDocument();
  });


  it('should display timeout error message if didHydrateState remains false after 10 seconds', async () => {
    render(<AppWithProviders />, { wrapper: TestAppWrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(10000); // Advance time by 10 seconds
    });

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByText(/The extension is taking longer than expected to load/)).toBeInTheDocument();
  });
  
  it('should clear timeout if component unmounts before timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    const { unmount } = render(<AppWithProviders />, { wrapper: TestAppWrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled(); 

    await act(async () => {
      jest.advanceTimersByTime(10000); 
    });
    
    // We can't query for text in an unmounted component.
    // The main check is that clearTimeoutSpy was called.
    // To be absolutely sure, one might re-render and check the error is NOT there,
    // but that complicates the test for "unmount" behavior.
    // For now, checking clearTimeout is sufficient.
    clearTimeoutSpy.mockRestore();
  });
});
