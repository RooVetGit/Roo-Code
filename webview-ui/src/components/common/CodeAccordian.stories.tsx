import type { Meta, StoryObj } from "@storybook/react"
import CodeAccordian from "./CodeAccordian"

const meta = {
	title: "Common/CodeAccordian",
	component: CodeAccordian,
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
} satisfies Meta<typeof CodeAccordian>

export default meta
type Story = StoryObj<typeof meta>

const sampleCode = `function calculateSum(a: number, b: number): number {
  return a + b;
}

// Example usage
const result = calculateSum(5, 3);
console.log(result); // 8`

export const Default: Story = {
	args: {
		code: sampleCode,
		path: "src/utils/math.ts",
		isExpanded: false,
		onToggleExpand: () => {},
	},
}

export const Expanded: Story = {
	args: {
		...Default.args,
		isExpanded: true,
	},
}

export const WithDiff: Story = {
	args: {
		diff: `- function oldSum(a, b) {
-   return a + b;
- }
+ function calculateSum(a: number, b: number): number {
+   return a + b;
+ }`,
		path: "src/utils/math.ts",
		isExpanded: true,
		onToggleExpand: () => {},
	},
}

export const ConsoleLogs: Story = {
	args: {
		code: `Server started on port 3000
Connected to database
[INFO] User authentication successful
[ERROR] Failed to load resource`,
		isConsoleLogs: true,
		isExpanded: true,
		onToggleExpand: () => {},
	},
}

export const UserFeedback: Story = {
	args: {
		code: `function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}`,
		isFeedback: true,
		isExpanded: true,
		onToggleExpand: () => {},
	},
}

export const Loading: Story = {
	args: {
		code: sampleCode,
		path: "src/utils/math.ts",
		isExpanded: true,
		onToggleExpand: () => {},
		isLoading: true,
	},
}

export const LongPath: Story = {
	args: {
		code: sampleCode,
		path: "very/long/path/to/the/source/code/file/that/should/be/truncated/with/ellipsis/math.ts",
		isExpanded: false,
		onToggleExpand: () => {},
	},
}

export const WithCustomLanguage: Story = {
	args: {
		code: ".container {\n  display: flex;\n  align-items: center;\n}",
		path: "styles.css",
		language: "css",
		isExpanded: true,
		onToggleExpand: () => {},
	},
}
