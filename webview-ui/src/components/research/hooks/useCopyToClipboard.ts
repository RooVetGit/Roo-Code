import { useState } from "react"

export interface UseCopyToClipboardProps {
	timeout?: number
}

export function useCopyToClipboard({ timeout = 2000 }: UseCopyToClipboardProps) {
	const [isCopied, setIsCopied] = useState<boolean>(false)

	const copyToClipboard = (value: string) => {
		if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
			return
		}

		if (!value) {
			return
		}

		navigator.clipboard.writeText(value).then(() => {
			setIsCopied(true)
			setTimeout(() => setIsCopied(false), timeout)
		})
	}

	return { isCopied, copyToClipboard }
}
