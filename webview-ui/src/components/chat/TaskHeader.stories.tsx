import type { Meta, StoryObj } from "@storybook/react"
import TaskHeader from "./TaskHeader"
import { ExtensionStateContextProvider } from "../../context/ExtensionStateContext"

const meta = {
	title: "Chat/TaskHeader",
	component: TaskHeader,
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story) => (
			<ExtensionStateContextProvider>
				<div style={{ maxWidth: "800px", margin: "0 auto" }}>
					<Story />
				</div>
			</ExtensionStateContextProvider>
		),
	],
} satisfies Meta<typeof TaskHeader>

export default meta
type Story = StoryObj<typeof meta>

const baseTask = {
	ts: Date.now(),
	type: "ask" as const,
	text: "Create a new React component that displays a list of items with pagination.",
}

export const Default: Story = {
	args: {
		task: baseTask,
		tokensIn: 1500,
		tokensOut: 800,
		doesModelSupportPromptCache: true,
		cacheWrites: 100,
		cacheReads: 50,
		totalCost: 0.0123,
		contextTokens: 2500,
		onClose: () => {},
	},
}

export const LongTask: Story = {
	args: {
		...Default.args,
		task: {
			...baseTask,
			text: "Create a new React component that displays a list of items with pagination. The component should support sorting, filtering, and custom rendering of items. It should also handle loading states, error states, and empty states gracefully. Add support for keyboard navigation and accessibility features. Include proper TypeScript types and comprehensive unit tests. The component should be responsive and work well on both desktop and mobile devices. Add documentation with examples of all features and edge cases.",
		},
	},
}

export const WithImages: Story = {
	args: {
		...Default.args,
		task: {
			...baseTask,
			images: [
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
			],
		},
	},
}

export const WithMentions: Story = {
	args: {
		...Default.args,
		task: {
			...baseTask,
			text: "Update the component in @/src/components/App.tsx and add tests in @/src/components/__tests__/App.test.tsx",
		},
	},
}

export const HighTokenUsage: Story = {
	args: {
		...Default.args,
		tokensIn: 15000,
		tokensOut: 8000,
		contextTokens: 25000,
	},
}

export const WithoutCache: Story = {
	args: {
		...Default.args,
		doesModelSupportPromptCache: false,
		cacheWrites: undefined,
		cacheReads: undefined,
	},
}
