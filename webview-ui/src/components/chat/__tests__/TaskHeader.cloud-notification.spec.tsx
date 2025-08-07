// npx vitest src/components/chat/__tests__/TaskHeader.cloud-notification.spec.tsx

import { render, screen, waitFor, act } from "@testing-library/react"
import { vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import TaskHeader, { TaskHeaderProps } from "../TaskHeader"
import { TooltipProvider } from "@src/components/ui/tooltip"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:task.title": "Task",
				"chat:task.expand": "Expand task",
				"chat:task.collapse": "Collapse task",
				"chat:cloudNotification.message":
					"This might take a while. Grab a coffee and continue from anywhere with Cloud.",
			}
			return translations[key] || key
		},
	}),
}))

// Mock ExtensionStateContext
const mockExtensionState = {
	apiConfiguration: {},
	currentTaskItem: { id: "test-task-id", size: 100 },
	dismissedCloudNotifications: new Set<string>(),
	addDismissedCloudNotification: vi.fn(),
}

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockExtensionState,
}))

// Mock useSelectedModel
vi.mock("@/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: () => ({
		id: "test-model",
		info: { contextWindow: 4000 },
	}),
}))

// Mock vscode
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock other components
vi.mock("../TaskActions", () => ({
	TaskActions: ({ showCloudNotification }: { showCloudNotification?: boolean }) => (
		<div data-testid="task-actions" data-show-cloud-notification={showCloudNotification}>
			Task Actions
		</div>
	),
}))

vi.mock("../CloudNotificationBanner", () => ({
	CloudNotificationBanner: ({ onDismiss, onNavigateToAccount }: any) => (
		<div data-testid="cloud-notification-banner">
			<button onClick={onDismiss} data-testid="dismiss-button">
				Dismiss
			</button>
			<button onClick={onNavigateToAccount} data-testid="navigate-button">
				Navigate
			</button>
		</div>
	),
}))

vi.mock("../TodoListDisplay", () => ({
	TodoListDisplay: () => <div data-testid="todo-list">Todo List</div>,
}))

vi.mock("../ContextWindowProgress", () => ({
	ContextWindowProgress: () => <div>Context Progress</div>,
}))

vi.mock("../Mention", () => ({
	Mention: ({ text }: { text: string }) => <span>{text}</span>,
}))

vi.mock("../../common/Thumbnails", () => ({
	default: () => <div>Thumbnails</div>,
}))

// Mock utils
vi.mock("@src/utils/format", () => ({
	formatLargeNumber: (num: number) => num.toString(),
}))

vi.mock("@src/lib/utils", () => ({
	cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}))

vi.mock("@roo/api", () => ({
	getModelMaxOutputTokens: () => 1000,
}))

describe("TaskHeader Cloud Notification", () => {
	let queryClient: QueryClient

	const defaultProps: TaskHeaderProps = {
		task: { type: "say", ts: Date.now() - 3 * 60 * 1000, text: "Test task", images: [] }, // 3 minutes ago
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.05,
		contextTokens: 1000,
		buttonsDisabled: true,
		handleCondenseContext: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		})

		// Reset mock state
		mockExtensionState.dismissedCloudNotifications.clear()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const renderTaskHeader = (props: Partial<TaskHeaderProps> = {}) => {
		return render(
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<TaskHeader {...defaultProps} {...props} />
				</TooltipProvider>
			</QueryClientProvider>,
		)
	}

	it("shows cloud notification for tasks running longer than 2 minutes", async () => {
		const taskStartTime = Date.now() - 3 * 60 * 1000 // 3 minutes ago
		renderTaskHeader({
			task: { type: "say", ts: taskStartTime, text: "Test task", images: [] },
			buttonsDisabled: true, // Task is still running
		})

		// Fast-forward timers to trigger the interval
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			expect(screen.getByTestId("cloud-notification-banner")).toBeInTheDocument()
		})
	})

	it("does not show cloud notification for tasks running less than 2 minutes", async () => {
		const taskStartTime = Date.now() - 1 * 60 * 1000 // 1 minute ago
		renderTaskHeader({
			task: { type: "say", ts: taskStartTime, text: "Test task", images: [] },
			buttonsDisabled: true, // Task is still running
		})

		// Fast-forward timers to trigger the interval
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			expect(screen.queryByTestId("cloud-notification-banner")).not.toBeInTheDocument()
		})
	})

	it("does not show cloud notification if already dismissed for this task", async () => {
		const taskStartTime = Date.now() - 3 * 60 * 1000 // 3 minutes ago
		mockExtensionState.dismissedCloudNotifications.add("test-task-id")

		renderTaskHeader({
			task: { type: "say", ts: taskStartTime, text: "Test task", images: [] },
			buttonsDisabled: true, // Task is still running
		})

		// Fast-forward timers to trigger the interval
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			expect(screen.queryByTestId("cloud-notification-banner")).not.toBeInTheDocument()
		})
	})

	it("does not show cloud notification for completed tasks (buttonsDisabled: false)", async () => {
		const taskStartTime = Date.now() - 3 * 60 * 1000 // 3 minutes ago
		renderTaskHeader({
			task: { type: "say", ts: taskStartTime, text: "Test task", images: [] },
			buttonsDisabled: false, // Task is completed/not running
		})

		// Fast-forward timers to trigger the interval
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			expect(screen.queryByTestId("cloud-notification-banner")).not.toBeInTheDocument()
		})
	})

	it("passes showCloudNotification prop to TaskActions", async () => {
		const taskStartTime = Date.now() - 3 * 60 * 1000 // 3 minutes ago
		renderTaskHeader({
			task: { type: "say", ts: taskStartTime, text: "Test task", images: [] },
			buttonsDisabled: true, // Task is still running
		})

		// Expand the task to see TaskActions
		const expandButton = screen.getByRole("button", { name: "Expand task" })
		act(() => {
			expandButton.click()
		})

		// Fast-forward timers to trigger the interval
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			const taskActions = screen.getByTestId("task-actions")
			expect(taskActions).toHaveAttribute("data-show-cloud-notification", "true")
		})
	})

	it("handles cloud notification dismissal", async () => {
		const taskStartTime = Date.now() - 3 * 60 * 1000 // 3 minutes ago
		renderTaskHeader({
			task: { type: "say", ts: taskStartTime, text: "Test task", images: [] },
			buttonsDisabled: true, // Task is still running
		})

		// Fast-forward timers to trigger the interval
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			expect(screen.getByTestId("cloud-notification-banner")).toBeInTheDocument()
		})

		// Dismiss the notification
		const dismissButton = screen.getByTestId("dismiss-button")
		act(() => {
			dismissButton.click()
		})

		expect(mockExtensionState.addDismissedCloudNotification).toHaveBeenCalledWith("test-task-id")
	})

	it("handles navigation to account page", async () => {
		const { vscode } = await import("@src/utils/vscode")
		const taskStartTime = Date.now() - 3 * 60 * 1000 // 3 minutes ago
		renderTaskHeader({
			task: { type: "say", ts: taskStartTime, text: "Test task", images: [] },
			buttonsDisabled: true, // Task is still running
		})

		// Fast-forward timers to trigger the interval
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			expect(screen.getByTestId("cloud-notification-banner")).toBeInTheDocument()
		})

		// Click navigate button
		const navigateButton = screen.getByTestId("navigate-button")
		act(() => {
			navigateButton.click()
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "switchTab",
			tab: "account",
		})
	})

	it("cleans up interval on unmount", () => {
		const clearIntervalSpy = vi.spyOn(global, "clearInterval")
		const { unmount } = renderTaskHeader()

		unmount()

		expect(clearIntervalSpy).toHaveBeenCalled()
	})

	it("updates duration tracking when task changes", async () => {
		const { rerender } = renderTaskHeader({
			task: { type: "say", ts: Date.now() - 1 * 60 * 1000, text: "Test task", images: [] },
			buttonsDisabled: true, // Task is still running
		})

		// Fast-forward timers
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		// Should not show notification yet
		expect(screen.queryByTestId("cloud-notification-banner")).not.toBeInTheDocument()

		// Update task to be older
		rerender(
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<TaskHeader
						{...defaultProps}
						task={{ type: "say", ts: Date.now() - 3 * 60 * 1000, text: "Test task", images: [] }}
						buttonsDisabled={true} // Task is still running
					/>
				</TooltipProvider>
			</QueryClientProvider>,
		)

		// Fast-forward timers
		act(() => {
			vi.advanceTimersByTime(1000)
		})

		await waitFor(() => {
			expect(screen.getByTestId("cloud-notification-banner")).toBeInTheDocument()
		})
	})
})
