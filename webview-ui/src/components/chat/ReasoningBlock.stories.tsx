import type { Meta, StoryObj } from "@storybook/react"
import ReasoningBlock from "./ReasoningBlock"

const meta = {
	title: "Chat/ReasoningBlock",
	component: ReasoningBlock,
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
} satisfies Meta<typeof ReasoningBlock>

export default meta
type Story = StoryObj<typeof meta>

const sampleContent = `Let me analyze the requirements and break down the task:

1. First, I need to understand the current codebase structure
   - Look for existing components
   - Check the file organization
   - Review any existing patterns

2. Key considerations:
   - Performance implications
   - Maintainability
   - Code reusability
   - Testing strategy

3. Implementation approach:
   - Start with core functionality
   - Add error handling
   - Implement edge cases
   - Write comprehensive tests

4. Next steps:
   - Create necessary files
   - Implement the component
   - Add documentation
   - Run tests`

export const Default: Story = {
	args: {
		content: sampleContent,
		isCollapsed: false,
		onToggleCollapse: () => {},
	},
}

export const Collapsed: Story = {
	args: {
		content: sampleContent,
		isCollapsed: true,
		onToggleCollapse: () => {},
	},
}

export const WithCodeBlocks: Story = {
	args: {
		content: `Here's my analysis of the code:

\`\`\`typescript
interface Props {
  items: string[];
  onSelect: (item: string) => void;
}
\`\`\`

The component needs to handle these props efficiently.

\`\`\`typescript
// Example implementation
const ListComponent: React.FC<Props> = ({ items, onSelect }) => {
  // Implementation here
};
\`\`\``,
		isCollapsed: false,
		onToggleCollapse: () => {},
	},
}

export const LongContent: Story = {
	args: {
		content: Array(5).fill(sampleContent).join("\n\n"),
		isCollapsed: false,
		onToggleCollapse: () => {},
	},
}

export const AutoHeight: Story = {
	args: {
		content: sampleContent,
		isCollapsed: false,
		onToggleCollapse: () => {},
		autoHeight: true,
	},
}
