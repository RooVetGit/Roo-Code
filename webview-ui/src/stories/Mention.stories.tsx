import type { Meta, StoryObj } from "@storybook/react"
import { Mention } from "../components/ui/mention/Mention"

const meta = {
	title: "UI/Mention",
	component: Mention,
	parameters: { layout: "centered" },
	tags: ["autodocs"],
} satisfies Meta<typeof Mention>

export default meta

type Story = StoryObj<typeof meta>

const suggestions = [
	{ id: "1", name: "Alice" },
	{ id: "2", name: "Bob" },
	{ id: "3", name: "Charlie" },
	{ id: "4", name: "David" },
	{ id: "5", name: "Eve" },
]

export const Default: Story = {
	args: {
		suggestions,
	},
	render: () => <MentionExample />,
}

const MentionExample = () => {
	return (
		<div className="w-full max-w-lg p-4">
			<p className="mb-2 text-sm text-muted-foreground">Type @ to trigger mentions.</p>
			<Mention suggestions={suggestions} />
		</div>
	)
}
