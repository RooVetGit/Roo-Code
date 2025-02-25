import type { Meta, StoryObj } from "@storybook/react"
import ChatView from "./ChatView"

const meta = {
	title: "Chat/ChatView",
	component: ChatView,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof ChatView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		showHistoryView: () => {},
		isHidden: false,
		showAnnouncement: false,
		hideAnnouncement: () => {},
	},
}

export const Hidden: Story = {
	args: {
		showHistoryView: () => {},
		isHidden: true,
		showAnnouncement: false,
		hideAnnouncement: () => {},
	},
}

export const WithAnnouncement: Story = {
	args: {
		showHistoryView: () => {},
		isHidden: false,
		showAnnouncement: true,
		hideAnnouncement: () => {},
	},
}
