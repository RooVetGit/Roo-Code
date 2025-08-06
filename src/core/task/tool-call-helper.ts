import { convertFunctionCallResponseToXml } from "../tools/schemas/function-call-converter"

export const handleOpenaiToolCall = (accumulatedToolCalls: any[], chunk: any): string => {
	// Accumulate tool call deltas
	for (const toolCallDelta of chunk.toolCalls) {
		const index = toolCallDelta.index || 0
		if (!accumulatedToolCalls[index]) {
			accumulatedToolCalls[index] = {
				id: toolCallDelta.id || "",
				type: "function",
				function: {
					name: "",
					arguments: "",
				},
			}
		}

		if (toolCallDelta.function?.name) {
			accumulatedToolCalls[index].function.name += toolCallDelta.function.name
		}
		if (toolCallDelta.function?.arguments) {
			accumulatedToolCalls[index].function.arguments += toolCallDelta.function.arguments
		}
	}
	// Convert accumulated tool calls to XML format
	if (accumulatedToolCalls.length > 0) {
		const mockResponse = {
			choices: [
				{
					message: {
						tool_calls: accumulatedToolCalls.filter((tc) => tc && tc.function.name),
					},
				},
			],
		}
		const xmlContent = convertFunctionCallResponseToXml(mockResponse, "openai")
		return xmlContent || ""
	}
	return ""
}
