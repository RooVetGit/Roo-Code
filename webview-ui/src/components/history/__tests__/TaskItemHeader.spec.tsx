import { render, screen } from "@/utils/test-utils"

import TaskItemHeader from "../TaskItemHeader"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock ModeBadge component
vi.mock("@/components/common/ModeBadge", () => ({
	ModeBadge: ({ modeSlug }: { modeSlug: string }) => <div data-testid="mode-badge">{modeSlug}</div>,
}))

const mockItem = {
	id: "1",
	number: 1,
	task: "Test task",
	ts: Date.now(),
	tokensIn: 100,
	tokensOut: 50,
	totalCost: 0.002,
	workspace: "/test/workspace",
}

describe("TaskItemHeader", () => {
	it("renders date information", () => {
		render(<TaskItemHeader item={mockItem} isSelectionMode={false} onDelete={vi.fn()} />)

		// TaskItemHeader shows the formatted date, not the task text
		expect(screen.getByText(/\w+ \d{1,2}, \d{1,2}:\d{2} \w{2}/)).toBeInTheDocument() // Date format like "JUNE 14, 10:15 AM"
	})

	it("shows delete button when not in selection mode", () => {
		render(<TaskItemHeader item={mockItem} isSelectionMode={false} onDelete={vi.fn()} />)

		expect(screen.getByRole("button")).toBeInTheDocument()
	})

	it("shows mode badge when item has mode", () => {
		const itemWithMode = { ...mockItem, mode: "code" }
		render(<TaskItemHeader item={itemWithMode} isSelectionMode={false} onDelete={vi.fn()} />)

		// ModeBadge would be mocked in the test
		expect(screen.getByTestId("mode-badge")).toBeInTheDocument()
		expect(screen.getByText("code")).toBeInTheDocument()
	})

	it("does not show mode badge when item has no mode", () => {
		render(<TaskItemHeader item={mockItem} isSelectionMode={false} onDelete={vi.fn()} />)

		// Verify no mode badge is rendered
		expect(screen.queryByTestId("mode-badge")).not.toBeInTheDocument()
	})
})
