import type { Meta, StoryObj } from "@storybook/react"
import ChatRow from "./ChatRow"

const meta = {
	title: "Chat/ChatRow",
	component: ChatRow,
	parameters: {
		layout: "padded",
	},
} satisfies Meta<typeof ChatRow>

export default meta
type Story = StoryObj<typeof meta>

const baseMessage = {
	ts: Date.now(),
	type: "say" as const,
	text: "Hello! I am the assistant. How can I help you today?",
}

export const AssistantMessage: Story = {
	args: {
		message: {
			...baseMessage,
			say: "text",
		},
		isExpanded: false,
		onToggleExpand: () => {},
		isLast: false,
		onHeightChange: () => {},
		isStreaming: false,
	},
}

export const UserFeedback: Story = {
	args: {
		message: {
			...baseMessage,
			type: "say",
			say: "user_feedback",
			text: "Can you help me with a coding question?",
		},
		isExpanded: false,
		onToggleExpand: () => {},
		isLast: false,
		onHeightChange: () => {},
		isStreaming: false,
	},
}

export const LoadingAPIRequest: Story = {
	args: {
		message: {
			...baseMessage,
			type: "say",
			say: "api_req_started",
			text: JSON.stringify({
				request: "Processing your request...",
			}),
		},
		isExpanded: false,
		onToggleExpand: () => {},
		isLast: true,
		onHeightChange: () => {},
		isStreaming: true,
	},
}

export const Error: Story = {
	args: {
		message: {
			...baseMessage,
			type: "say",
			say: "error",
			text: "Sorry, there was an error processing your request.",
		},
		isExpanded: false,
		onToggleExpand: () => {},
		isLast: false,
		onHeightChange: () => {},
		isStreaming: false,
	},
}
