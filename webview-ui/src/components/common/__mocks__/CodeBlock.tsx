import { vi } from "vitest"
import * as React from "react"

interface CodeBlockProps {
	children?: React.ReactNode
	language?: string
	code?: string
	"data-testid"?: string
	className?: string
}

// Create a mock function with Vitest
const CodeBlock = vi.fn<[CodeBlockProps?], React.ReactElement>(
	({
		children,
		language = "text",
		code = "",
		"data-testid": dataTestId = "mock-code-block",
		className = "",
	} = {}) => (
		<div data-testid={dataTestId} data-language={language} className={className}>
			{code || children || "Mocked Code Block"}
		</div>
	),
)

export default CodeBlock
