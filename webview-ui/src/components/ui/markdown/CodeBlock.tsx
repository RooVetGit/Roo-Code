import { FC, memo, useState, useEffect, useCallback } from "react"
import { codeToHtml } from "shiki"
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/components/ui/hooks"
import { Button } from "@/components/ui"

interface CodeBlockProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
	language: string
	value: string
}

export const CodeBlock: FC<CodeBlockProps> = memo(({ language, value, className, ...props }) => {
	const [highlightedCode, setHighlightedCode] = useState<string>("")
	const { isCopied, copy } = useClipboard()

	const onCopy = useCallback(() => {
		if (!isCopied) {
			copy(value)
		}
	}, [isCopied, copy, value])

	useEffect(() => {
		const highlight = async () => {
			// Read body attribute to get VS Code theme kind
			const vscodeThemeKind = document.body.dataset.vscodeThemeKind || "vscode-dark" // Default to dark if undefined

			// Select shiki theme based on VS Code theme kind
			const shikiTheme = vscodeThemeKind === "vscode-light" ? "github-light" : "github-dark"

			try {
				const html = await codeToHtml(value, {
					lang: language,
					theme: shikiTheme, // Use the dynamically determined theme
					transformers: [
						{
							pre(node) {
								node.properties.class = cn(className, "overflow-x-auto")
								return node
							},
							code(node) {
								node.properties.style = "background-color: transparent !important;"
								return node
							},
						},
					],
				})

				setHighlightedCode(html)
			} catch (e) {
				setHighlightedCode(value)
			}
		}

		highlight()
	}, [language, value, className])

	return (
		<div className="relative" {...props}>
			<div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
			<Button
				variant="outline"
				size="icon"
				className="absolute top-1 right-1 cursor-pointer bg-black/10"
				onClick={onCopy}>
				{isCopied ? (
					<CheckIcon style={{ width: 12, height: 12 }} />
				) : (
					<CopyIcon style={{ width: 12, height: 12 }} />
				)}
			</Button>
		</div>
	)
})
CodeBlock.displayName = "CodeBlock"
