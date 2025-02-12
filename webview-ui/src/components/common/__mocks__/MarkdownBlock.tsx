import { vi } from "vitest"
import * as React from "react"

interface MarkdownBlockProps {
	children?: React.ReactNode
	content?: string
	"data-testid"?: string
	className?: string
}

const MarkdownBlock = vi.fn<[MarkdownBlockProps?], React.ReactElement>(
	({ content = "", children, "data-testid": dataTestId = "mock-markdown-block", className = "" } = {}) => (
		<div data-testid={dataTestId} className={className}>
			{content || children || "Mocked Markdown Block"}
		</div>
	),
)

export default MarkdownBlock
