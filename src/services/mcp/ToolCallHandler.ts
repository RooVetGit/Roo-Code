import { ToolName, NewTaskMessageSchema, SendMessageSchema, ASK_REPLY_EVENT, Event } from "./types"
import { NotificationEventHub } from "./NotificationEventHub"
import { RooCodeAPI } from "../../exports/interface"

export const apiToolHandler =
	(eventHub: NotificationEventHub, api: RooCodeAPI, timeoutMs: number = 5_000) =>
	async ({ toolName, arguments: args }: { toolName: any; arguments: any }) => {
		let result
		console.log("Tool called:", toolName, args)
		switch (toolName) {
			case ToolName.START_NEW_TASK:
				const validatedArgs1 = NewTaskMessageSchema.parse(args)
				api.startNewTask({ text: validatedArgs1.task })
				break
			case ToolName.SEND_MESSAGE:
				const validatedArgs2 = SendMessageSchema.parse(args)
				api.sendMessage(validatedArgs2.message)
				break
			case ToolName.PRESS_PRIMARY_BUTTON:
				api.pressPrimaryButton()
				break
			case ToolName.PRESS_SECONDARY_BUTTON:
				api.pressSecondaryButton()
				break
			default:
				result = "Unknown tool name"
				return result
		}

		const clientId = `client-${Date.now()}`
		const emitter = eventHub.subscribe(clientId)
		const waitForEndCurrentTurnOrTimeout = new Promise<Event | null>((resolve) => {
			let timeoutId: NodeJS.Timeout
			let lastRelevantMessageEvent: Event | null = null

			// Function to reset or set the timeout
			const resetTimeout = () => {
				// Clear existing timeout if any
				if (timeoutId) clearTimeout(timeoutId)

				// Set a new timeout
				timeoutId = setTimeout(() => {
					eventHub.unsubscribe(clientId)
					emitter.removeListener(ASK_REPLY_EVENT, eventListener)
					resolve(lastRelevantMessageEvent)
				}, timeoutMs)
			}

			// Set initial timeout
			resetTimeout()

			const eventListener = (event: Event) => {
				// Reset timeout on any event
				resetTimeout()
				console.log("Event received:", event)

				// Track the last relevant message event before EndCurrentTurn
				if (
					event.event !== "EndCurrentTurn" &&
					event.data &&
					event.data.text &&
					event.data.text !== undefined &&
					event.data.text !== ""
				) {
					lastRelevantMessageEvent = event
				}

				if (event.event === "EndCurrentTurn") {
					clearTimeout(timeoutId)
					eventHub.unsubscribe(clientId)
					emitter.removeListener(ASK_REPLY_EVENT, eventListener)
					resolve(lastRelevantMessageEvent)
				}
			}

			emitter.on(ASK_REPLY_EVENT, eventListener)
		})

		// Wait for either the event or timeout
		const lastRelevantMessageEvent = await waitForEndCurrentTurnOrTimeout
		eventHub.unsubscribe(clientId)
		result = lastRelevantMessageEvent ? JSON.stringify(lastRelevantMessageEvent) : "Task Done"
		return result
	}
