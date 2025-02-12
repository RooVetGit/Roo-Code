import { FC, memo } from "react"
import ReactMarkdown, { Options } from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { DOCUMENT_FILE_TYPES, DocumentFileType, SourceData } from "../types"
import { CodeBlock } from "./CodeBlock"
import { DocumentInfo } from "./DocumentInfo"
import { SourceNumberButton } from "./SourceNumberButton"

const MemoizedReactMarkdown: FC<Options> = memo(
	ReactMarkdown,
	(prevProps, nextProps) => prevProps.children === nextProps.children && prevProps.className === nextProps.className,
)

const preprocessLaTeX = (content: string) => {
	// Replace block-level LaTeX delimiters \[ \] with $$ $$
	const blockProcessedContent = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `$$${equation}$$`)
	// Replace inline LaTeX delimiters \( \) with $ $
	const inlineProcessedContent = blockProcessedContent.replace(
		/\\\[([\s\S]*?)\\\]/g,
		(_, equation) => `$${equation}$`,
	)
	return inlineProcessedContent
}

/**
 * Update the citation flag [citation:id]() to the new format [citation:index](url)
 */
const preprocessCitations = (input: string, sources?: SourceData) => {
	let content = input
	if (sources) {
		const citationRegex = /\[citation:(.+?)\]\(\)/g
		let match
		// Find all the citation references in the content
		while ((match = citationRegex.exec(content)) !== null) {
			const citationId = match[1]
			// Find the source node with the id equal to the citation-id, also get the index of the source node
			const sourceNode = sources.nodes.find((node) => node.id === citationId)
			// If the source node is found, replace the citation reference with the new format
			if (sourceNode !== undefined) {
				content = content.replace(match[0], `[citation:${sources.nodes.indexOf(sourceNode)}]()`)
			} else {
				// If the source node is not found, remove the citation reference
				content = content.replace(match[0], "")
			}
		}
	}
	return content
}

const preprocessContent = (content: string, sources?: SourceData) => {
	return preprocessCitations(preprocessLaTeX(content), sources)
}

export function Markdown({ content, sources, backend }: { content: string; sources?: SourceData; backend?: string }) {
	const processedContent = preprocessContent(content, sources)

	return (
		<div>
			<MemoizedReactMarkdown
				className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 custom-markdown break-words"
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeKatex as any]}
				components={{
					p({ children }) {
						return <div className="mb-2 last:mb-0">{children}</div>
					},
					code({ /* inline, */ className, children, ...props }) {
						if (children && Array.isArray(children) && children.length) {
							if (children[0] === "▍") {
								return <span className="mt-1 animate-pulse cursor-default">▍</span>
							}

							children[0] = (children[0] as string).replace("`▍`", "▍")
						}

						const match = /language-(\w+)/.exec(className || "")

						// if (inline) {
						// 	return (
						// 		<code className={className} {...props}>
						// 			{children}
						// 		</code>
						// 	)
						// }

						return (
							<CodeBlock
								key={Math.random()}
								language={(match && match[1]) || ""}
								value={String(children).replace(/\n$/, "")}
								className="mb-2"
								{...props}
							/>
						)
					},
					a({ href, children }) {
						// If href starts with `{backend}/api/files`, then it's a local document and we use DocumenInfo for rendering
						if (href?.startsWith(`${backend}/api/files`)) {
							// Check if the file is document file type
							const fileExtension = href.split(".").pop()?.toLowerCase()

							if (fileExtension && DOCUMENT_FILE_TYPES.includes(fileExtension as DocumentFileType)) {
								return (
									<DocumentInfo
										document={{
											url: backend ? new URL(decodeURIComponent(href)).href : href,
											sources: [],
										}}
										className="mb-2 mt-2"
									/>
								)
							}
						}
						// If a text link starts with 'citation:', then render it as a citation reference
						if (
							Array.isArray(children) &&
							typeof children[0] === "string" &&
							children[0].startsWith("citation:")
						) {
							const index = Number(children[0].replace("citation:", ""))
							if (!isNaN(index)) {
								return <SourceNumberButton index={index} />
							}
							// citation is not looked up yet, don't render anything
							return null
						}
						return (
							<a href={href} target="_blank" rel="noopener noreferrer">
								{children}
							</a>
						)
					},
				}}>
				{processedContent}
			</MemoizedReactMarkdown>
		</div>
	)
}
