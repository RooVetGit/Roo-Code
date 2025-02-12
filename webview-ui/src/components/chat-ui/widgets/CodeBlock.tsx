import { FC, memo, useEffect, useRef } from "react"
import hljs from "highlight.js"
import { Check, Copy, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useClipboard } from "@/hooks/useClipboard"

interface Props {
	language: string
	value: string
	className?: string
}

interface languageMap {
	[key: string]: string | undefined
}

export const programmingLanguages: languageMap = {
	javascript: ".js",
	python: ".py",
	java: ".java",
	c: ".c",
	cpp: ".cpp",
	"c++": ".cpp",
	"c#": ".cs",
	ruby: ".rb",
	php: ".php",
	swift: ".swift",
	"objective-c": ".m",
	kotlin: ".kt",
	typescript: ".ts",
	go: ".go",
	perl: ".pl",
	rust: ".rs",
	scala: ".scala",
	haskell: ".hs",
	lua: ".lua",
	shell: ".sh",
	sql: ".sql",
	html: ".html",
	css: ".css",
	// add more file extensions here, make sure the key is same as language prop in CodeBlock.tsx component
}

export const generateRandomString = (length: number, lowercase = false) => {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXY3456789" // excluding similar looking characters like Z, 2, I, 1, O, 0
	let result = ""
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length))
	}
	return lowercase ? result.toLowerCase() : result
}

const CodeBlock: FC<Props> = memo(({ language, value, className }) => {
	const { isCopied, copy } = useClipboard()
	const codeRef = useRef<HTMLElement>(null)

	useEffect(() => {
		if (codeRef.current && codeRef.current.dataset.highlighted !== "yes") {
			hljs.highlightElement(codeRef.current)
		}
	}, [language, value])

	const downloadAsFile = () => {
		if (typeof window === "undefined") {
			return
		}
		const fileExtension = programmingLanguages[language] || ".file"
		const suggestedFileName = `file-${generateRandomString(3, true)}${fileExtension}`
		const fileName = window.prompt("Enter file name", suggestedFileName)

		if (!fileName) {
			// User pressed cancel on prompt.
			return
		}

		const blob = new Blob([value], { type: "text/plain" })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.download = fileName
		link.href = url
		link.style.display = "none"
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}

	const onCopy = () => {
		if (!isCopied) {
			copy(value)
		}
	}

	return (
		<div className={`codeblock relative w-full bg-zinc-950 font-sans ${className}`}>
			<div className="flex w-full items-center justify-between bg-zinc-800 px-6 py-2 pr-4 text-zinc-100">
				<span className="text-xs lowercase">{language}</span>
				<div className="flex items-center space-x-1">
					<Button variant="ghost" onClick={downloadAsFile} size="icon">
						<Download />
						<span className="sr-only">Download</span>
					</Button>
					<Button variant="ghost" size="icon" onClick={onCopy}>
						{isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
						<span className="sr-only">Copy code</span>
					</Button>
				</div>
			</div>
			<pre className="border border-zinc-700 text-white">
				<code ref={codeRef} className={`language-${language} font-mono`}>
					{value}
				</code>
			</pre>
		</div>
	)
})
CodeBlock.displayName = "CodeBlock"

export { CodeBlock }
