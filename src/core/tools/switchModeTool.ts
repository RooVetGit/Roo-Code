import delay from "delay"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { defaultAgentSlug, getAgentBySlug } from "../../shared/agents"

export async function switchModeTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const agent_slug: string | undefined = block.params.mode_slug
	const reason: string | undefined = block.params.reason

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "switchMode",
				mode: removeClosingTag("mode_slug", agent_slug),
				reason: removeClosingTag("reason", reason),
			})

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!agent_slug) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("switch_mode")
				pushToolResult(await cline.sayAndCreateMissingParamError("switch_mode", "mode_slug"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Verify the agent exists
			const targetAgent = getAgentBySlug(agent_slug, (await cline.providerRef.deref()?.getState())?.customModes)

			if (!targetAgent) {
				cline.recordToolError("switch_mode")
				pushToolResult(formatResponse.toolError(`Invalid agent: ${agent_slug}`))
				return
			}

			// Check if already in requested agent
			const currentAgent = (await cline.providerRef.deref()?.getState())?.mode ?? defaultAgentSlug

			if (currentAgent === agent_slug) {
				cline.recordToolError("switch_mode")
				pushToolResult(`Already in ${targetAgent.name} agent.`)
				return
			}

			const completeMessage = JSON.stringify({ tool: "switchMode", mode: agent_slug, reason })
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			// Switch the agent using shared handler
			await cline.providerRef.deref()?.handleModeSwitch(agent_slug)

			pushToolResult(
				`Successfully switched from ${getAgentBySlug(currentAgent)?.name ?? currentAgent} agent to ${
					targetAgent.name
				} agent${reason ? ` because: ${reason}` : ""}.`,
			)

			await delay(500) // Delay to allow agent change to take effect before next tool is executed

			return
		}
	} catch (error) {
		await handleError("switching mode", error)
		return
	}
}
