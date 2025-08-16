import { MessageHandlerStrategy, MessageHandlerContext } from "../types"
import { ModelRecord } from "../../../../shared/api"
import { flushModels, getModels } from "../../../../api/providers/fetchers/modelCache"

/**
 * Strategy for handling requestCopilotModels message
 */
export class RequestCopilotModelsStrategy implements MessageHandlerStrategy {
	async handle(context: MessageHandlerContext): Promise<void> {
		const { provider } = context

		try {
			await flushModels("copilot")

			const copilotModels = await getModels({
				provider: "copilot",
			})
			provider.postMessageToWebview({
				type: "copilotModels",
				copilotModels,
			})
		} catch (error) {
			console.error("Failed to fetch Copilot models:", error)
			provider.postMessageToWebview({
				type: "copilotModels",
				copilotModels: {},
			})
		}
	}
}
