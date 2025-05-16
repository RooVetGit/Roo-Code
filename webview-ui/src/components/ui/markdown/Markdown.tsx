import React, { FC, memo, MouseEvent } from "react"
import ReactMarkdown, { Options } from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { vscode } from "@src/utils/vscode"

import { Separator } from "@/components/ui"

import { CodeBlock } from "./CodeBlock"
import { Blockquote } from "./Blockquote"

const MemoizedReactMarkdown: FC<Options & { isComplete?: boolean }> = memo(
	ReactMarkdown,
	(prevProps: Options & { isComplete?: boolean }, nextProps: Options & { isComplete?: boolean }) => {
		// Compare children, className, and isComplete
		const childrenEqual = prevProps.children === nextProps.children
		const classNameEqual = prevProps.className === nextProps.className
		const isCompleteEqual = prevProps.isComplete === nextProps.isComplete
		// Only skip rendering if all relevant props are equal
		return childrenEqual && classNameEqual && isCompleteEqual
	},
)

export function Markdown({ content, isComplete }: { content: string; isComplete?: boolean }) {
	// Added optional isComplete prop
	return (
		<MemoizedReactMarkdown
			remarkPlugins={[remarkGfm]}
			isComplete={isComplete}
			className="custom-markdown break-words text-[var(--vscode-font-size)]"
			components={{
				p({ children }) {
					return <div className="mb-2 last:mb-0">{children}</div>
				},
				hr() {
					return <Separator />
				},
				ol({ children }) {
					return (
						<ol className="list-decimal pl-[2.5em] [&>li]:mb-1 [&>li:last-child]:mb-0 [&>li>ul]:mt-1 [&>li>ol]:mt-1">
							{children}
						</ol>
					)
				},
				ul({ children }) {
					return (
						<ul className="list-disc pl-[2.5em] [&>li]:mb-1 [&>li:last-child]:mb-0 [&>li>ul]:mt-1 [&>li>ol]:mt-1">
							{children}
						</ul>
					)
				},
				blockquote({ children }) {
					return <Blockquote>{children}</Blockquote>
				},
				code({ className, children, ...props }) {
					if (children && Array.isArray(children) && children.length) {
						if (children[0] === "▍") {
							return <span className="mt-1 animate-pulse cursor-default">▍</span>
						}

						children[0] = (children[0] as string).replace("`▍`", "▍")
					}

					const match = /language-(\w+)/.exec(className || "")

					const isInline =
						props.node?.position && props.node.position.start.line === props.node.position.end.line

					return isInline ? (
						<code
							className={cn(
								"font-mono bg-[var(--vscode-textCodeBlock-background)] text-muted-foreground px-1 py-[0.1em] rounded-sm border border-border inline-block align-baseline",
								className, // Allow original className (like language-) to be passed if needed, though less likely for inline
							)}
							{...props}>
							{children}
						</code>
					) : (
						<CodeBlock
							language={(match && match[1]) || ""}
							value={String(children).replace(/\n$/, "")}
							className="rounded-xs p-3 mb-2" // Keep existing classes for now, margin replacement was reverted/failed
							isComplete={isComplete ?? true} // Pass down isComplete, default to true if undefined
						/>
					)
				},
				table({ children }) {
					// Use w-full for full width, border-collapse for clean borders,
					// border and border-border for VS Code theme-aware borders, my-2 for margin
					return <table className="w-full my-2 border-collapse border border-border">{children}</table>
				},
				thead({ children }) {
					// Add bottom border and a subtle background consistent with muted elements
					return <thead className="border-b border-border bg-muted/50">{children}</thead>
				},
				tbody({ children }) {
					// No specific styling needed for tbody itself
					return <tbody>{children}</tbody>
				},
				tr({ children }) {
					// Add bottom border, hover effect, and remove border for the last row
					return (
						<tr className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted last:border-b-0">
							{children}
						</tr>
					)
				},
				th({ children }) {
					// Add right border, padding, left alignment, medium font weight, muted text color,
					// and remove border for the last header cell
					return (
						<th className="border-r border-border p-2 text-left align-middle font-medium text-muted-foreground last:border-r-0">
							{children}
						</th>
					)
				},
				strong({ children }) {
					// Apply a slightly lighter font weight than default bold
					return <strong className="font-semibold">{children}</strong>
				},
				td({ children }) {
					// Add right border, padding, left alignment, and remove border for the last data cell
					return (
						<td className="border-r border-border p-2 text-left align-middle last:border-r-0">
							{children}
						</td>
					)
				},
				a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
					if (typeof href === "undefined") {
						return <span>{children}</span>
					}

					return (
						<a
							href={href}
							title={href}
							onClick={(e) => handleLinkClick(e, href)} // Call the helper function
						>
							{children}
						</a>
					)
				},
			}}>
			{content}
		</MemoizedReactMarkdown>
	)
}

const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
	if (!href) {
		return
	}

	const isLocalPath = href.startsWith("file://") || href.startsWith("/") || !href.includes("://")

	if (!isLocalPath) {
		// For non-local links, allow default behavior
		return
	}

	event.preventDefault() // Prevent default navigation for local links

	let filePath = href.replace("file://", "")

	const match = filePath.match(/(.*):(\d+)(-\d+)?$/)
	let values = undefined
	if (match) {
		filePath = match[1]
		values = { line: parseInt(match[2], 10) }
	}

	if (!filePath.startsWith("/") && !filePath.startsWith("./")) {
		filePath = "./" + filePath
	}

	vscode.postMessage({
		type: "openFile",
		text: filePath,
		values,
	})
}
