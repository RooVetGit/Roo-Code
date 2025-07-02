import { vscode } from "@src/utils/vscode"
import i18next from "i18next"

export interface MermaidFixResult {
	success: boolean
	fixedCode?: string
	error?: string
	attempts?: number
}

export interface MermaidValidationResult {
	isValid: boolean
	error?: string
}

/**
 * Service for validating and fixing Mermaid syntax using LLM assistance
 */
export class MermaidSyntaxFixer {
	private static readonly MAX_FIX_ATTEMPTS = 2
	private static readonly FIX_TIMEOUT = 30000 // 30 seconds

	/**
	 * Applies deterministic fixes for common LLM errors before validation
	 */
	static applyDeterministicFixes(code: string): string {
		let cleanedCode = code // use variable to be able to add comments to each step

		// Fix HTML entity encoding: --&gt; should be -->;
		// surprisingly, this does most of the heavy lifting in fixing the Mermaid syntax
		cleanedCode = cleanedCode.replace(/--&gt;/g, "-->")

		// sometimes the llm wraps the respond in a code block, starting with  ```mermaid and ending with ```
		// we remove those to get the actual code
		cleanedCode = cleanedCode.replace(/^```mermaid/, "").replace(/```$/, "")

		return cleanedCode
	}

	/**
	 * Validates Mermaid syntax using the mermaid library
	 */
	static async validateSyntax(code: string): Promise<MermaidValidationResult> {
		try {
			const mermaid = (await import("mermaid")).default
			await mermaid.parse(code)
			return { isValid: true }
		} catch (error) {
			return {
				isValid: false,
				error: error instanceof Error ? error.message : i18next.t("common:mermaid.errors.unknown_syntax"),
			}
		}
	}

	/**
	 * Requests the LLM to fix the Mermaid syntax via the extension
	 */
	private static requestLLMFix(
		code: string,
		error: string,
	): Promise<{ fixedCode: string } | { requestError: string }> {
		return new Promise((resolve, _reject) => {
			const requestId = `mermaid-fix-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

			const timeout = setTimeout(() => {
				cleanup()
				resolve({ requestError: i18next.t("common:mermaid.errors.fix_timeout") })
			}, this.FIX_TIMEOUT)

			const messageListener = (event: MessageEvent) => {
				const message = event.data
				if (message.type === "mermaidFixResponse" && message.requestId === requestId) {
					cleanup()

					if (message.success) {
						resolve({ fixedCode: message.fixedCode })
					} else {
						resolve({
							requestError: message.error || i18next.t("common:mermaid.errors.fix_request_failed"),
						})
					}
				}
			}

			const cleanup = () => {
				clearTimeout(timeout)
				window.removeEventListener("message", messageListener)
			}

			window.addEventListener("message", messageListener)

			vscode.postMessage({
				type: "fixMermaidSyntax",
				requestId,
				text: code,
				values: { error },
			})
		})
	}

	/**
	 * Attempts to fix Mermaid syntax with automatic retry and fallback
	 * Always returns the best attempt at fixing the code, even if not completely successful
	 */
	static async autoFixSyntax(code: string): Promise<MermaidFixResult> {
		let currentCode = code
		let llmAttempts = 0
		let finalError: string | undefined

		while (true) {
			currentCode = this.applyDeterministicFixes(currentCode)

			// Validate the current code
			const validation = await this.validateSyntax(currentCode)
			if (validation.isValid) {
				return {
					success: true,
					fixedCode: currentCode,
					attempts: llmAttempts,
				}
			}

			const lastError = validation.error || i18next.t("common:mermaid.errors.unknown_syntax")

			// break in the middle so we start and finish the loop with a deterministic fix
			if (llmAttempts >= this.MAX_FIX_ATTEMPTS) {
				finalError = i18next.t("common:mermaid.errors.fix_attempts", {
					attempts: this.MAX_FIX_ATTEMPTS,
					error: lastError,
				})
				break
			}

			llmAttempts++
			const result = await this.requestLLMFix(currentCode, lastError)

			if ("requestError" in result) {
				finalError = result.requestError
				break
			} else if (!result.fixedCode) {
				finalError = i18next.t("common:mermaid.errors.no_fix_provided")
				break
			} else {
				currentCode = result.fixedCode
			}
		}

		return {
			success: false,
			fixedCode: currentCode,
			error: finalError,
			attempts: llmAttempts,
		}
	}
}
