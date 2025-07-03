import { render, screen, fireEvent } from "@/utils/test-utils"
import { CopyButton } from "../CopyButton"
import { vscode } from "@/utils/vscode"

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("CopyButton", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("sends copy message with task ID when clicked", () => {
		render(<CopyButton itemId="test-task-id" />)

		const copyButton = screen.getByRole("button")
		fireEvent.click(copyButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "copyTask",
			text: "test-task-id",
		})
	})
})
