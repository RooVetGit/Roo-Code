import { useQuery } from "@tanstack/react-query"

import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"

const getSapAiCoreModels = async () =>
	new Promise<{ success: boolean; models: string[]; error?: string }>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("SAP AI Core models request timed out"))
		}, 15000) // Longer timeout for API calls

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "sapAiCoreModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.sapAiCoreModels) {
					resolve(message.sapAiCoreModels)
				} else {
					reject(new Error("No SAP AI Core models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestSapAiCoreModels" })
	})

export const useSapAiCoreModels = (enabled: boolean = false) =>
	useQuery({
		queryKey: ["sapAiCoreModels"],
		queryFn: getSapAiCoreModels,
		enabled,
		retry: 1,
		staleTime: 5 * 60 * 1000, // 5 minutes
	})
