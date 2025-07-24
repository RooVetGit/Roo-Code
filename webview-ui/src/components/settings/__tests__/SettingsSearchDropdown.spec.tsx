import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { SettingsSearchDropdown } from "../SettingsSearchDropdown"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: () => "" }),
}))

vi.mock("@src/components/ui", () => ({
	Popover: ({ children }: any) => <>{children}</>,
	PopoverTrigger: ({ children }: any) => <>{children}</>,
	PopoverContent: ({ children }: any) => <>{children}</>,
	StandardTooltip: ({ children }: any) => <>{children}</>,
}))

vi.mock("../searchUtils", () => ({
	getSearchableSettings: () => [],
	searchSettings: () => [],
}))

describe("SettingsSearchDropdown", () => {
	it("renders", async () => {
		const onSelect = vi.fn()
		render(<SettingsSearchDropdown onSelectSetting={onSelect} />)

		const btn = screen.getByRole("button")
		expect(btn).toBeInTheDocument()

		await userEvent.click(btn)
		expect(screen.getByRole("textbox")).toBeInTheDocument()
	})
})
