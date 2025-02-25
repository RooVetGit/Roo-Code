import type { Meta, StoryObj } from "@storybook/react"
import BrowserSessionRow from "./BrowserSessionRow"
import { ExtensionStateContextProvider } from "../../context/ExtensionStateContext"
import { ClineMessage, ClineAsk } from "../../../../src/shared/ExtensionMessage"

const meta = {
	title: "Chat/BrowserSessionRow",
	component: BrowserSessionRow,
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story) => (
			<ExtensionStateContextProvider>
				<div
					style={{
						maxWidth: "800px",
						margin: "0 auto",
						backgroundColor: "var(--vscode-editor-background)",
						padding: "20px",
					}}>
					<Story />
				</div>
			</ExtensionStateContextProvider>
		),
	],
} satisfies Meta<typeof BrowserSessionRow>

export default meta
type Story = StoryObj<typeof meta>

const sampleScreenshot =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

const baseMessages: ClineMessage[] = [
	{
		ts: Date.now(),
		type: "ask",
		ask: "browser_action_launch" as ClineAsk,
		text: "https://example.com",
	},
]

export const LaunchingBrowser: Story = {
	args: {
		messages: baseMessages,
		isExpanded: () => false,
		onToggleExpand: () => {},
		isLast: true,
		onHeightChange: () => {},
		isStreaming: false,
	},
}

export const BrowserWithScreenshot: Story = {
	args: {
		messages: [
			...baseMessages,
			{
				ts: Date.now() + 1,
				type: "say" as const,
				say: "browser_action_result",
				text: JSON.stringify({
					currentUrl: "https://example.com",
					screenshot: sampleScreenshot,
					currentMousePosition: "450,300",
					logs: "Console log example",
				}),
			},
		],
		isExpanded: () => false,
		onToggleExpand: () => {},
		isLast: true,
		onHeightChange: () => {},
		isStreaming: false,
	},
}

export const WithClickAction: Story = {
	args: {
		messages: [
			...baseMessages,
			{
				ts: Date.now() + 1,
				type: "say" as const,
				say: "browser_action",
				text: JSON.stringify({
					action: "click",
					coordinate: "450,300",
				}),
			},
		],
		isExpanded: () => false,
		onToggleExpand: () => {},
		isLast: true,
		onHeightChange: () => {},
		isStreaming: true,
	},
}

export const WithMultipleActions: Story = {
	args: {
		messages: [
			...baseMessages,
			{
				ts: Date.now() + 1,
				type: "say" as const,
				say: "browser_action_result",
				text: JSON.stringify({
					currentUrl: "https://example.com",
					screenshot: sampleScreenshot,
					currentMousePosition: "450,300",
					logs: "Page loaded",
				}),
			},
			{
				ts: Date.now() + 2,
				type: "say" as const,
				say: "browser_action",
				text: JSON.stringify({
					action: "click",
					coordinate: "200,150",
				}),
			},
			{
				ts: Date.now() + 3,
				type: "say" as const,
				say: "browser_action_result",
				text: JSON.stringify({
					currentUrl: "https://example.com/clicked",
					screenshot: sampleScreenshot,
					currentMousePosition: "200,150",
					logs: "Clicked element",
				}),
			},
		],
		isExpanded: () => false,
		onToggleExpand: () => {},
		isLast: true,
		onHeightChange: () => {},
		isStreaming: false,
	},
}
