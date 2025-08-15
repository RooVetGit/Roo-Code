import { MessageHandlerStrategy, MessageHandlerContext } from "../types"
import { getCopilotModels } from "../../../../api/providers/fetchers/copilot"
import { ModelRecord } from "../../../../shared/api"

/**
 * Strategy for handling requestCopilotModels message
 */
export class RequestCopilotModelsStrategy implements MessageHandlerStrategy {
	async handle(context: MessageHandlerContext): Promise<void> {
		const { provider } = context

		try {
			const copilotModels = await getCopilotModels()
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
