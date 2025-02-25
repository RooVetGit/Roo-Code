import type { Meta, StoryObj } from "@storybook/react"
import ChatTextArea from "."
import { Mode } from "../../../../../src/shared/modes"
import { fn } from "@storybook/test"

const meta = {
	title: "Chat/ChatTextArea",
	component: ChatTextArea,
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: "800px", margin: "0 auto" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ChatTextArea>

export default meta
type Story = StoryObj<typeof ChatTextArea>

const onHeightChangeSpy = fn()

const defaultArgs = {
	inputValue: "",
	setInputValue: () => {},
	textAreaDisabled: false,
	placeholderText: "Type a message...",
	selectedImages: [],
	setSelectedImages: () => {},
	onSend: () => {},
	onSelectImages: () => {},
	shouldDisableImages: false,
	mode: "code" as Mode,
	setMode: () => {},
	onHeightChange: onHeightChangeSpy,
}

export const Empty: Story = {
	args: defaultArgs,
}

export const WithText: Story = {
	args: {
		...defaultArgs,
		inputValue: "Hello, how can you help me today?",
	},
}

export const WithImages: Story = {
	args: {
		...defaultArgs,
		selectedImages: [
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
		],
	},
}

export const Disabled: Story = {
	args: {
		...defaultArgs,
		textAreaDisabled: true,
		inputValue: "This text area is disabled",
	},
}

export const WithMention: Story = {
	args: {
		...defaultArgs,
		inputValue: "Check this file @/src/index.ts for more details",
	},
}

export const WithPlaceholder: Story = {
	args: {
		...defaultArgs,
		placeholderText: "Ask me anything about your code...",
	},
}

// New stories for improved layout and functionality

export const WideMode: Story = {
	parameters: {
		layout: "fullscreen",
	},
	decorators: [
		(Story) => (
			<div style={{ width: "1200px", margin: "0 auto", padding: "20px" }}>
				<Story />
			</div>
		),
	],
	args: defaultArgs,
}

export const ResponsiveLayout: Story = {
	parameters: {
		layout: "fullscreen",
	},
	decorators: [
		(Story) => (
			<div style={{ padding: "20px" }}>
				<h3 style={{ marginBottom: "20px" }}>Mobile View (360px)</h3>

				<div style={{ width: "200px", background: "black", marginBottom: "40px" }}>
					<Story />
				</div>

				<div style={{ width: "360px", background: "black", marginBottom: "40px" }}>
					<Story />
				</div>

				<h3 style={{ marginBottom: "20px" }}>Tablet View (768px)</h3>
				<div style={{ width: "768px", background: "black", marginBottom: "40px" }}>
					<Story />
				</div>

				<h3 style={{ marginBottom: "20px" }}>Desktop View (1200px)</h3>
				<div style={{ width: "1200px", background: "black" }}>
					<Story />
				</div>
			</div>
		),
	],
	args: defaultArgs,
}

// Story with quick action buttons
export const WithQuickActions: Story = {
	args: {
		...defaultArgs,
		inputValue: "Here is some text that can be enhanced or cleared",
	},
}
