import React from "react"

import { Mention } from "@src/components/chat/Mention"
import { CodeBlock } from "@src/components/common/CodeBlock"
import MermaidBlock from "@src/components/common/MermaidBlock"

export const rehypeMentions = (props: any) => {
	const { children, ...rest } = props
	return <p {...rest}>{children.map((node: any) => (typeof node === "string" ? <Mention text={node} /> : node))}</p>
}

export const rehypeCode = (props: any) => {
	const { children } = props

	// Check for Mermaid diagrams first.
	if (Array.isArray(children) && children.length === 1 && React.isValidElement(children[0])) {
		const child = children[0] as React.ReactElement<{ className?: string }>

		if (child.props?.className?.includes("language-mermaid")) {
			return child
		}
	}

	// For all other code blocks, use CodeBlock with copy button.
	const codeNode = children?.[0]

	if (!codeNode?.props?.children) {
		return null
	}

	const language =
		(Array.isArray(codeNode.props?.className) ? codeNode.props.className : [codeNode.props?.className]).map(
			(c: string) => c?.replace("language-", ""),
		)[0] || "javascript"

	const source = codeNode.props.children[0] || ""

	if (!source) {
		return null
	}

	return <CodeBlock source={source} language={language} />
}

export const rehypeMermaid = (props: any) => {
	const className = props.className || ""

	if (className.includes("language-mermaid")) {
		const code = String(props.children || "")

		if (!code) {
			return null
		}

		return <MermaidBlock code={code} />
	}

	return <code {...props} />
}
