import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolResponse } from "../../shared/tools"
import { Task, TaskOptions } from "../task/Task" // Assuming TaskOptions might be useful
import { ClineProvider } from "../webview/ClineProvider"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { defaultModeSlug } from "../../shared/modes" // For default base_mode
import { SYSTEM_PROMPT } from "../prompts/system" // To potentially build dynamic system prompts
import { Anthropic } from "@anthropic-ai/sdk" // For message types

interface ParticipantDefinition {
	base_mode?: string // Slug for a base mode
	dynamic_persona_instructions: string
}

interface StartConversationParams {
	participants: ParticipantDefinition[]
	shared_context: string
	initial_prompt: string
	termination_condition: string // A question for the referee LLM
}

export async function startConversationTool(
	cline: Task, // The orchestrator Task instance
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	// Extract and parse parameters
	// The 'participants' parameter will be a JSON string from the LLM.
	let participantsString = block.params.participants
	let sharedContext = block.params.shared_context
	let initialPrompt = block.params.initial_prompt
	let terminationCondition = block.params.termination_condition

	// Partial handling
	if (block.partial) {
		const partialData = {
			tool: "start_conversation",
			participants: removeClosingTag("participants", participantsString),
			shared_context: removeClosingTag("shared_context", sharedContext),
			initial_prompt: removeClosingTag("initial_prompt", initialPrompt),
			termination_condition: removeClosingTag("termination_condition", terminationCondition),
		}
		await cline.say("tool_in_progress", JSON.stringify(partialData), undefined, true)
		return
	}

	// Validate required parameters
	if (!participantsString) {
		return await handleErrorMissingParam("participants")
	}
	if (!sharedContext) {
		// Allow empty shared_context, but it must be explicitly provided if intended.
		// For now, let's make it required for simplicity in the first pass.
		return await handleErrorMissingParam("shared_context")
	}
	if (!initialPrompt) {
		return await handleErrorMissingParam("initial_prompt")
	}
	if (!terminationCondition) {
		return await handleErrorMissingParam("termination_condition")
	}

	async function handleErrorMissingParam(paramName: string) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("start_conversation")
		pushToolResult(await cline.sayAndCreateMissingParamError("start_conversation", paramName))
	}

	let parsedParticipants: ParticipantDefinition[]
	try {
		parsedParticipants = JSON.parse(participantsString)
		if (!Array.isArray(parsedParticipants) || parsedParticipants.length !== 2) {
			throw new Error("Participants parameter must be an array of two agent definitions.")
		}
		for (const p of parsedParticipants) {
			if (typeof p.dynamic_persona_instructions !== 'string') {
				throw new Error("Each participant must have 'dynamic_persona_instructions' as a string.")
			}
			if (p.base_mode && typeof p.base_mode !== 'string') {
				throw new Error("Participant 'base_mode', if provided, must be a string.")
			}
		}
	} catch (error) {
		await handleError(t("tools:startConversation.errors.paramParseError", { param: "participants", error: error.message }), error)
		cline.recordToolError("start_conversation", `Failed to parse participants: ${error.message}`)
		pushToolResult(formatResponse.toolError(`Error parsing 'participants' parameter: ${error.message}`))
		return
	}

	cline.consecutiveMistakeCount = 0

	const toolMessage = JSON.stringify({
		tool: "start_conversation",
		participants: parsedParticipants.map(p => ({ base_mode: p.base_mode || defaultModeSlug, persona: p.dynamic_persona_instructions })),
		shared_context: sharedContext,
		initial_prompt: initialPrompt,
		termination_condition: terminationCondition,
	}, null, 2)

	const didApprove = await askApproval("tool", toolMessage)
	if (!didApprove) {
		pushToolResult(formatResponse.toolError(t("common:errors.user_rejected_tool_use", { toolName: "start_conversation" })))
		return
	}

	const provider = cline.providerRef.deref()
	if (!provider) {
		await handleError("start_conversation", new Error("ClineProvider reference lost"))
		pushToolResult(formatResponse.toolError("Internal error: Provider reference lost."))
		return
	}

	let agentA_Task: Task | undefined = undefined
	let agentB_Task: Task | undefined = undefined
	const conversationTranscript: { speaker: string, utterance: string }[] = []

	try {
		await cline.say("text", "Setting up debate agents...", undefined, false, undefined, "in_progress")

		// Agent Setup
		const setupAgent = async (participantDef: ParticipantDefinition, agentName: string): Promise<Task> => {
			const agentMode = participantDef.base_mode || defaultModeSlug;
			const providerState = await provider.getState();

			// Generate the base system prompt for the agent's mode
			// Note: SYSTEM_PROMPT function needs various parameters from the provider's state.
			const baseSystemPrompt = await SYSTEM_PROMPT(
				provider.context,
				provider.cwd, // Assuming debate agents operate in the same CWD
				providerState.browserToolEnabled ?? false,
				undefined, // mcpHub - debate agents likely won't use MCP tools directly in this simple setup
				undefined, // diffStrategy
				providerState.browserViewportSize,
				agentMode, // Use the agent's specific mode here
				providerState.customModePrompts,
				providerState.customModes,
				"", // customInstructions for this agent are from dynamic_persona_instructions
				providerState.diffEnabled ?? false,
				providerState.experiments,
				providerState.enableMcpServerCreation,
				providerState.language,
				undefined, // rooIgnoreInstructions
				(providerState.maxReadFileLine ?? -1) !== -1,
				{ maxConcurrentFileReads: providerState.maxConcurrentFileReads }
			);

			const dynamicSystemPrompt = `${baseSystemPrompt}\n\nYour specific instructions for this conversation:\n${participantDef.dynamic_persona_instructions}`;

			// Create the temporary task with the systemPromptOverride
			// These tasks are not added to the main clineStack by initClineWithTask,
			// because we are calling new Task() directly.
			const agentTask = new Task({
				provider: provider,
				apiConfiguration: cline.apiConfiguration, // Use orchestrator's API config
				task: `Internal debate agent: ${agentName}`,
				startTask: false,
				systemPromptOverride: dynamicSystemPrompt, // Pass the fully constructed prompt
				// Other minimal TaskOptions if needed
				enableDiff: providerState.diffEnabled,
				enableCheckpoints: false, // No checkpoints for transient debate agents
			});
			await agentTask.overwriteApiConversationHistory([]); // Start with a fresh history
			return agentTask;
		}

		agentA_Task = await setupAgent(parsedParticipants[0], "AgentA");
		agentB_Task = await setupAgent(parsedParticipants[1], "AgentB");

		// Conversation Loop
		let currentSpeakerTask = agentA_Task
		let currentSpeakerName = "AgentA"
		let nextSpeakerTask = agentB_Task
		let nextSpeakerName = "AgentB"
		let lastUtterance = initialPrompt

		conversationTranscript.push({ speaker: "Context", utterance: sharedContext });
		conversationTranscript.push({ speaker: "Orchestrator", utterance: initialPrompt });
		await cline.say("text", `Debate started. Context: "${sharedContext}". Initial prompt to AgentA: "${initialPrompt}"`, undefined, false, undefined, "in_progress")


		const MAX_TURNS = 10 // Safeguard against infinite loops
		for (let turn = 0; turn < MAX_TURNS; turn++) {
			// Prepare input for current_speaker_task
			const currentTurnInput: Anthropic.Messages.MessageParam = {
				role: "user",
				content: `${sharedContext}\n\nPrevious utterances:\n${conversationTranscript.map(t => `${t.speaker}: ${t.utterance}`).join("\n\n")}\n\nYour turn, ${currentSpeakerName}. Respond to: ${lastUtterance}`
			}

			await currentSpeakerTask.addToApiConversationHistory(currentTurnInput);

			// Execute a "turn" for current_speaker_task
			// This requires a simplified way to get a single response from a Task
			// without its full UI interaction loop.
			let assistantResponseText = "";
			try {
				const stream = currentSpeakerTask.attemptApiRequest(); // Assuming this returns the stream directly
				for await (const chunk of stream) {
					if (chunk.type === "text") {
						assistantResponseText += chunk.text;
					} else if (chunk.type === "usage") {
						// log usage if necessary
					}
				}
				if (!assistantResponseText) throw new Error("Agent did not provide a text response.");

				// Add assistant's response to its own history for context in *its* next turn (if any)
				await currentSpeakerTask.addToApiConversationHistory({role: "assistant", content: [{type: "text", text: assistantResponseText}]});

			} catch (e) {
				assistantResponseText = `Error during ${currentSpeakerName}'s turn: ${e.message}`;
				conversationTranscript.push({ speaker: currentSpeakerName, utterance: assistantResponseText });
				await cline.say("text", `Error in ${currentSpeakerName}'s turn: ${e.message}. Ending debate.`, undefined, false, undefined, "error")
				break; // End debate on error
			}

			conversationTranscript.push({ speaker: currentSpeakerName, utterance: assistantResponseText });
			lastUtterance = assistantResponseText;
			await cline.say("text", `${currentSpeakerName} says: "${assistantResponseText}"`, undefined, false, undefined, "in_progress")


			// Referee Check
			const refereePrompt = `Conversation History:\n${conversationTranscript.map(t => `${t.speaker}: ${t.utterance}`).join("\n\n")}\n\nTermination Condition: "${terminationCondition}"\n\nBased on the conversation, has the termination condition been met? Answer strictly with "yes" or "no".`
			const refereeResponse = await cline.api.createMessage(
				await cline.getSystemPrompt(), // Orchestrator's system prompt for referee
				[{role: "user", content: refereePrompt}],
				{taskId: cline.taskId, mode: (await provider.getState()).mode ?? defaultModeSlug} // Orchestrator's metadata
			)

			let refereeDecision = "";
			// Assuming createMessage returns a stream similar to Task's attemptApiRequest
			for await (const chunk of refereeResponse) {
				if (chunk.type === "text") refereeDecision += chunk.text;
			}
			refereeDecision = refereeDecision.trim().toLowerCase();
			await cline.say("text", `Referee decision: "${refereeDecision}" (Condition: "${terminationCondition}")`, undefined, false, undefined, "in_progress")


			if (refereeDecision.includes("yes")) {
				await cline.say("text", "Termination condition met. Ending debate.", undefined, false, undefined, "complete")
				break
			}

			if (turn === MAX_TURNS - 1) {
				await cline.say("text", "Max turns reached. Ending debate.", undefined, false, undefined, "complete")
				break
			}

			// Swap speakers
			[currentSpeakerTask, nextSpeakerTask] = [nextSpeakerTask, currentSpeakerTask];
			[currentSpeakerName, nextSpeakerName] = [nextSpeakerName, currentSpeakerName];
		}

		// Return Result
		const finalTranscript = conversationTranscript.map(t => `${t.speaker}: ${t.utterance}`).join("\n\n")
		pushToolResult(formatResponse.toolSuccess(`Debate finished. Transcript:\n${finalTranscript}`))

	} catch (error) {
		await handleError(t("tools:startConversation.errors.generic", { error: error.message }), error)
		cline.recordToolError("start_conversation", error.message)
		pushToolResult(formatResponse.toolError(`Error in start_conversation: ${error.message}`))
	} finally {
		// Cleanup
		agentA_Task?.dispose(); // Task.dispose() needs to be robust
		agentB_Task?.dispose();
		await cline.say("text", "Debate agents cleaned up.", undefined, false, undefined, "complete")
	}
}
