import React from "react"
import { vi } from "vitest"

// Define prop types with more specificity
interface CheckboxProps {
	children?: React.ReactNode
	checked?: boolean
	onChange?: (event: React.MouseEvent) => void
	"data-testid"?: string
}

interface DropdownProps {
	children?: React.ReactNode
	value?: string
	onChange?: (event: React.MouseEvent) => void
	"data-testid"?: string
}

interface PaneProps {
	children?: React.ReactNode
	"data-testid"?: string
}

export type DropdownOption = {
	label: string
	value: string
}

// Create mock components with vi.fn() for better testability
export const Checkbox = vi.fn(
	({ children, checked = false, onChange = vi.fn(), "data-testid": dataTestId = "mock-checkbox" }: CheckboxProps) =>
		React.createElement(
			"div",
			{
				"data-testid": dataTestId,
				"data-checked": checked,
				onClick: onChange,
			},
			children,
		),
)

export const Dropdown = vi.fn(
	({ children, value, onChange = vi.fn(), "data-testid": dataTestId = "mock-dropdown" }: DropdownProps) =>
		React.createElement(
			"div",
			{
				"data-testid": dataTestId,
				"data-value": value,
				onClick: onChange,
			},
			children,
		),
)

export const Pane = vi.fn(({ children, "data-testid": dataTestId = "mock-pane" }: PaneProps) =>
	React.createElement(
		"div",
		{
			"data-testid": dataTestId,
		},
		children,
	),
)

// Add mock reset functionality
Checkbox.mockClear = vi.fn()
Dropdown.mockClear = vi.fn()
Pane.mockClear = vi.fn()
