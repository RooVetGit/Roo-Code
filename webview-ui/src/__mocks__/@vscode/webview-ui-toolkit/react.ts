import React from "react"
import { vi } from "vitest"

interface VSCodeProps {
	children?: React.ReactNode
	onClick?: () => void
	onChange?: (e: any) => void
	onInput?: (e: any) => void
	appearance?: string
	checked?: boolean
	value?: string | number
	placeholder?: string
	href?: string
	"data-testid"?: string
	style?: React.CSSProperties
	slot?: string
	role?: string
	disabled?: boolean
	className?: string
	title?: string
}

// Create mock implementations with vi.fn()
export const VSCodeButton = vi.fn(
	({ children, onClick, appearance, className, disabled = false, ...props }: VSCodeProps) => {
		// Create comprehensive mock methods to prevent errors
		const mockFocusMethods = {
			focus: vi.fn(),
			blur: vi.fn(),
			setAttribute: vi.fn(),
			getAttribute: vi.fn(),
			removeAttribute: vi.fn(),
		}

		// Create a button element with additional mock properties
		const buttonProps = {
			onClick: onClick || vi.fn(),
			className: className || "",
			disabled,
			...mockFocusMethods,
			...props,
		}

		// Enhance the button with additional mock capabilities
		Object.defineProperties(buttonProps, {
			focus: {
				value: mockFocusMethods.focus,
				writable: true,
				configurable: true,
			},
			blur: {
				value: mockFocusMethods.blur,
				writable: true,
				configurable: true,
			},
		})

		return React.createElement("button", buttonProps, children)
	},
)

export const VSCodeCheckbox = vi.fn(({ children, onChange, checked, ...props }: VSCodeProps) =>
	React.createElement("label", {}, [
		React.createElement("input", {
			type: "checkbox",
			onChange: onChange || vi.fn(),
			checked: checked || false,
			...props,
		}),
		children,
	]),
)

export const VSCodeTextField = vi.fn(({ children, value, onInput, placeholder, ...props }: VSCodeProps) =>
	React.createElement("input", {
		type: "text",
		value: value || "",
		onInput: onInput || vi.fn(),
		placeholder: placeholder || "",
		...props,
	}),
)

export const VSCodeTextArea = vi.fn(({ value, onChange, ...props }: VSCodeProps) =>
	React.createElement("textarea", {
		value: value || "",
		onChange: onChange || vi.fn(),
		...props,
	}),
)

export const VSCodeLink = vi.fn(({ children, href, ...props }: VSCodeProps) =>
	React.createElement(
		"a",
		{
			href: href || "",
			...props,
		},
		children,
	),
)

export const VSCodeDropdown = vi.fn(({ children, value, onChange, ...props }: VSCodeProps) =>
	React.createElement(
		"select",
		{
			value: value || "",
			onChange: onChange || vi.fn(),
			...props,
		},
		children,
	),
)

export const VSCodeOption = vi.fn(({ children, value, ...props }: VSCodeProps) =>
	React.createElement(
		"option",
		{
			value: value || "",
			...props,
		},
		children,
	),
)

export const VSCodeRadio = vi.fn(({ children, value, checked, onChange, ...props }: VSCodeProps) =>
	React.createElement("input", {
		type: "radio",
		value: value || "",
		checked: checked || false,
		onChange: onChange || vi.fn(),
		...props,
	}),
)

export const VSCodeRadioGroup = vi.fn(({ children, onChange, ...props }: VSCodeProps) =>
	React.createElement(
		"div",
		{
			onChange: onChange || vi.fn(),
			...props,
		},
		children,
	),
)

export const VSCodeSlider = vi.fn(({ value, onChange, ...props }: VSCodeProps) =>
	React.createElement("input", {
		type: "range",
		value: value || 0,
		onChange: onChange || vi.fn(),
		...props,
	}),
)

// Reset all mocks before each test
vi.resetAllMocks()
