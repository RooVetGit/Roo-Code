import type { Meta, StoryObj } from "@storybook/react"
import ContextMenu from "./ContextMenu"
import { ContextMenuOptionType } from "../../utils/context-mentions"
import { ModeConfig } from "../../../../src/shared/modes"

const meta = {
	title: "Chat/ContextMenu",
	component: ContextMenu,
	parameters: {
		layout: "padded",
	},
	decorators: [
		(Story) => (
			<div style={{ height: "300px", position: "relative" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

const sampleModes: ModeConfig[] = [
	{
		name: "Act Mode",
		slug: "act",
		roleDefinition: "Execute actions and make changes",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		name: "Plan Mode",
		slug: "plan",
		roleDefinition: "Plan and discuss changes",
		groups: ["read", "browser", "mcp"],
	},
]

const sampleQueryItems = [
	{
		type: ContextMenuOptionType.File,
		value: "/src/components/App.tsx",
	},
	{
		type: ContextMenuOptionType.OpenedFile,
		value: "/src/index.tsx",
	},
	{
		type: ContextMenuOptionType.Folder,
		value: "/src/components",
	},
	{
		type: ContextMenuOptionType.Git,
		value: "abc123",
		label: "Add new feature",
		description: "abc123 by John Doe on Feb 21",
	},
]

export const Default: Story = {
	args: {
		searchQuery: "",
		selectedIndex: -1,
		setSelectedIndex: () => {},
		onSelect: () => {},
		onMouseDown: () => {},
		selectedType: null,
		queryItems: sampleQueryItems,
		modes: sampleModes,
	},
}

export const WithSearchQuery: Story = {
	args: {
		...Default.args,
		searchQuery: "app",
	},
}

export const WithSelectedFile: Story = {
	args: {
		...Default.args,
		selectedType: ContextMenuOptionType.File,
		selectedIndex: 0,
	},
}

export const WithGitCommits: Story = {
	args: {
		...Default.args,
		selectedType: ContextMenuOptionType.Git,
		selectedIndex: 3,
	},
}

export const NoResults: Story = {
	args: {
		...Default.args,
		searchQuery: "nonexistentfile",
	},
}

export const WithModes: Story = {
	args: {
		...Default.args,
		selectedType: ContextMenuOptionType.Mode,
		selectedIndex: 0,
	},
}
