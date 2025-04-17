import { FC, memo, useState, useEffect, useCallback } from "react"
import { codeToHtml } from "shiki"
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/components/ui/hooks"
import { Button } from "@/components/ui"

interface CodeBlockProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
	language: string
	value: string
	isComplete: boolean // Added isComplete prop
}

export const CodeBlock: FC<CodeBlockProps> = memo(({ language, value, className, isComplete, ...props }) => {
	// Added isComplete to params
	const [highlightedCode, setHighlightedCode] = useState<string>("")
	// Removed isHighlighted state as it's redundant now
	const { isCopied, copy } = useClipboard()

	const onCopy = useCallback(() => {
		if (!isCopied) {
			copy(value)
		}
	}, [isCopied, copy, value])

	useEffect(() => {
		// Only highlight when the message stream is complete
		if (!isComplete) {
			setHighlightedCode("") // Clear highlighted code if streaming starts/continues
			// Optionally clear old code: setHighlightedCode("");
			return // Don't highlight yet
		}

		// If complete, proceed with highlighting
		// This line calling the removed setIsHighlighted is now deleted.

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
				// No need to set isHighlighted anymore
			} catch (e) {
				// Log the initial highlighting failure
				console.error(`Shiki highlighting failed for lang "${language}":`, e)
				try {
					// Attempt to highlight as plaintext as a fallback
					const plaintextHtml = await codeToHtml(value, {
						lang: "plaintext", // Force plaintext
						theme: shikiTheme,
						transformers: [
							// Keep the same transformers
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
					setHighlightedCode(plaintextHtml) // Set plaintext highlighted code
				} catch (e2) {
					// If plaintext highlighting also fails, log error and fall back to raw code placeholder
					console.error("Shiki plaintext highlighting failed:", e2)
					setHighlightedCode("") // Ensure placeholder is shown on double error
				}
			}
		}

		highlight()
	}, [language, value, className, isComplete]) // Added isComplete to dependencies

	return (
		<div className="relative" {...props}>
			{highlightedCode ? ( // Render based on whether highlightedCode has content
				// Render highlighted code when ready
				<div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
			) : (
				// Render raw code placeholder while highlighting
				// Apply className passed from Markdown.tsx and shiki transformer styles
				<pre className={cn(className, "overflow-x-auto")}>
					<code style={{ backgroundColor: "transparent !important" }}>{value}</code>
				</pre>
			)}
			{/* Keep the copy button outside the conditional rendering */}
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
