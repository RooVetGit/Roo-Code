import type { Meta, StoryObj } from "@storybook/react"
import CodeBlock from "./CodeBlock"
import { ExtensionStateContextProvider } from "../../context/ExtensionStateContext"

const meta = {
	title: "Common/CodeBlock",
	component: CodeBlock,
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
} satisfies Meta<typeof CodeBlock>

export default meta
type Story = StoryObj<typeof meta>

export const JavaScript: Story = {
	args: {
		source: `\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);

function add(a, b) {
  return a + b;
}

// Example usage
const result = add(5, 3);
console.log(result); // 8
\`\`\``,
	},
}

export const TypeScript: Story = {
	args: {
		source: `\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUser(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }
}
\`\`\``,
	},
}

export const WithDiff: Story = {
	args: {
		source: `\`\`\`diff
- const oldFunction = (x) => {
-   return x * 2;
- }
+ const newFunction = (x: number): number => {
+   return x * 2;
+ }
\`\`\``,
	},
}

export const LongContent: Story = {
	args: {
		source: `\`\`\`typescript
${Array(20)
	.fill(
		`
interface Props {
  title: string;
  description: string;
  onClick: () => void;
}

const Component: React.FC<Props> = ({ title, description, onClick }) => {
  return (
    <div onClick={onClick}>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
};
`,
	)
	.join("\n")}
\`\`\``,
	},
}

export const ForceWrap: Story = {
	args: {
		source: `\`\`\`typescript
const veryLongLine = "This is a very long line of code that would normally require horizontal scrolling but with forceWrap enabled it will wrap to the next line instead of creating a horizontal scrollbar which can be useful in certain situations where you want to ensure all content is visible without scrolling horizontally";

const anotherLongLine = "Here's another example of a long line that demonstrates the text wrapping behavior when forceWrap is set to true in the CodeBlock component's props";
\`\`\``,
		forceWrap: true,
	},
}

export const MultipleCodeBlocks: Story = {
	args: {
		source: `
Here's a JavaScript example:

\`\`\`javascript
const greeting = "Hello!";
console.log(greeting);
\`\`\`

And here's some TypeScript:

\`\`\`typescript
interface Greeting {
  message: string;
}
\`\`\`

Finally, some CSS:

\`\`\`css
.greeting {
  color: blue;
  font-size: 16px;
}
\`\`\`
`,
	},
}
