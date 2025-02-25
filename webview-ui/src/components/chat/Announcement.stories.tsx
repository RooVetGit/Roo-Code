import type { Meta, StoryObj } from "@storybook/react"
import Announcement from "./Announcement"

const meta = {
	title: "Chat/Announcement",
	component: Announcement,
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
} satisfies Meta<typeof Announcement>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		version: "3.2.0",
		hideAnnouncement: () => {},
	},
}

export const WithCustomVersion: Story = {
	args: {
		version: "3.3.0",
		hideAnnouncement: () => {},
	},
}

// Add dark mode variant
export const DarkMode: Story = {
	args: {
		version: "3.2.0",
		hideAnnouncement: () => {},
	},
	parameters: {
		backgrounds: {
			default: "dark",
		},
	},
}
