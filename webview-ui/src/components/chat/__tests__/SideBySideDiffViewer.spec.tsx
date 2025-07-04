import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SideBySideDiffViewer } from "../SideBySideDiffViewer"

// Mock the StandardTooltip component
vi.mock("@/components/ui", () => ({
	StandardTooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
		<div title={content}>{children}</div>
	),
}))

// Mock the utility functions
vi.mock("@src/utils/getLanguageFromPath", () => ({
	getLanguageFromPath: vi.fn(() => "javascript"),
}))

vi.mock("@src/utils/removeLeadingNonAlphanumeric", () => ({
	removeLeadingNonAlphanumeric: vi.fn((path: string) => path),
}))

describe("SideBySideDiffViewer", () => {
	const mockFiles = [
		{
			path: "test.js",
			changeCount: 2,
			key: "test.js (2 changes)",
			content: "test content",
			diffs: [
				{
					content: `<<<<<<< SEARCH
const oldFunction = () => {
  return "old";
}
=======
const newFunction = () => {
  return "new";
}
>>>>>>> REPLACE`,
					startLine: 1,
				},
			],
		},
	]

	it("renders without crashing", () => {
		render(<SideBySideDiffViewer files={mockFiles} ts={Date.now()} />)
		expect(screen.getByText("1 file with 2 changes")).toBeInTheDocument()
	})

	it("renders file summary correctly", () => {
		render(<SideBySideDiffViewer files={mockFiles} ts={Date.now()} />)
		expect(screen.getByText("1 file with 2 changes")).toBeInTheDocument()
		expect(screen.getByText("Expand All")).toBeInTheDocument()
	})

	it("renders multiple files correctly", () => {
		const multipleFiles = [
			...mockFiles,
			{
				path: "test2.js",
				changeCount: 1,
				key: "test2.js (1 change)",
				content: "test content 2",
				diffs: [
					{
						content: `<<<<<<< SEARCH
old line
=======
new line
>>>>>>> REPLACE`,
						startLine: 1,
					},
				],
			},
		]

		render(<SideBySideDiffViewer files={multipleFiles} ts={Date.now()} />)
		expect(screen.getByText("2 files with 3 changes")).toBeInTheDocument()
	})

	it("returns null when no files provided", () => {
		const { container } = render(<SideBySideDiffViewer files={[]} ts={Date.now()} />)
		expect(container.firstChild).toBeNull()
	})

	it("handles undefined files gracefully", () => {
		const { container } = render(<SideBySideDiffViewer files={undefined as any} ts={Date.now()} />)
		expect(container.firstChild).toBeNull()
	})
})
