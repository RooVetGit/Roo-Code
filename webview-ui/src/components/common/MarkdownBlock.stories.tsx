import type { Meta, StoryObj } from "@storybook/react"
import MarkdownBlock from "./MarkdownBlock"
import { ExtensionStateContextProvider } from "../../context/ExtensionStateContext"

const meta = {
	title: "Common/MarkdownBlock",
	component: MarkdownBlock,
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
} satisfies Meta<typeof MarkdownBlock>

export default meta
type Story = StoryObj<typeof meta>

export const SimpleText: Story = {
	args: {
		markdown: "This is a simple paragraph of text.",
	},
}

export const WithFormatting: Story = {
	args: {
		markdown: `# Heading 1
## Heading 2
### Heading 3

**Bold text** and *italic text*

* Bullet point 1
* Bullet point 2
  * Nested bullet point

1. Numbered item 1
2. Numbered item 2
   1. Nested numbered item`,
	},
}

export const WithCodeBlocks: Story = {
	args: {
		markdown: `Here's some inline \`code\` and a code block:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function greetUser(user: User) {
  console.log(\`Hello, \${user.name}!\`);
}
\`\`\``,
	},
}

export const WithLinks: Story = {
	args: {
		markdown: `Here are some links:
* [Link with text](https://example.com)
* Plain URL: https://example.com
* Another URL in text: Check out https://github.com for more info.`,
	},
}

export const WithDiffBlocks: Story = {
	args: {
		markdown: `Here's a diff block showing changes:

\`\`\`diff
- const oldFunction = (x) => {
-   return x * 2;
- }
+ const newFunction = (x: number): number => {
+   return x * 2;
+ }
\`\`\``,
	},
}

export const ComplexContent: Story = {
	args: {
		markdown: `# Project Documentation

## Overview
This project implements a React component library with TypeScript support.

### Installation
\`\`\`bash
npm install @my/components
\`\`\`

### Usage Example
Here's how to use the main component:

\`\`\`typescript
import { Button } from '@my/components';

function App() {
  return (
    <Button 
      variant="primary"
      onClick={() => console.log('Clicked!')}
    >
      Click Me
    </Button>
  );
}
\`\`\`

### Key Features
* 🚀 **Performance Optimized**
* 💅 *Fully Styled*
* 📱 Responsive Design

For more information, visit https://example.com/docs

> Note: This is a blockquote with some important information.`,
	},
}

export const WithTables: Story = {
	args: {
		markdown: `| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Done | Implemented with JWT |
| Authorization | 🚧 WIP | Role-based access |
| API Integration | ❌ Todo | Planned for v2 |`,
	},
}

export const WithTaskLists: Story = {
	args: {
		markdown: `Project Tasks:
- [x] Setup project
- [x] Add core components
- [ ] Write documentation
- [ ] Add tests
  - [x] Unit tests
  - [ ] Integration tests
  - [ ] E2E tests`,
	},
}
