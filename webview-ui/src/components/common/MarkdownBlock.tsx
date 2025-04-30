import React, { memo, useEffect } from "react"
import { useRemark } from "react-remark"
import { ComponentOptions } from "rehype-react"

import { remarkUrls, remarkCodeLang } from "@src/utils/remark"
import { rehypeMentions, rehypeCode, rehypeMermaid } from "@src/utils/rehype"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import { StyledMarkdown } from "./MarkdownBlock.styles"

export type RehypePlugin = "mentions" | "code" | "mermaid"

interface MarkdownBlockProps {
	markdown?: string
	renderMentions?: boolean
	renderCode?: boolean
	renderMermaid?: boolean
}

export const MarkdownBlock = memo(
	({ markdown, renderMentions = false, renderCode = true, renderMermaid = true }: MarkdownBlockProps) => {
		const { theme } = useExtensionState()

		const components: ComponentOptions<typeof React.createElement>["components"] = {}

		if (renderMentions) {
			components.p = rehypeMentions
		}

		if (renderCode) {
			components.pre = rehypeCode
		}

		if (renderMermaid) {
			components.code = rehypeMermaid
		}

		const [reactContent, setMarkdown] = useRemark({
			remarkPlugins: [remarkUrls, remarkCodeLang],
			rehypePlugins: [],
			rehypeReactOptions: { components },
		})

		useEffect(() => setMarkdown(markdown || ""), [markdown, setMarkdown, theme])

		return <StyledMarkdown>{reactContent}</StyledMarkdown>
	},
)

export default MarkdownBlock
