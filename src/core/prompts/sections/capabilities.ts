import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"

import { ModeConfig } from "../../../shared/modes"

export function getCapabilitiesSection(
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	modeConfig?:ModeConfig
): string {
	const tools_group = modeConfig?.groups || []

	if  (tools_group?.length === 0) {
		return `====

CAPABILITIES

- You can directly output the mermaid format flowchart for rendering, in the format like:
\`\`\`mermaid
graph TD
    A("start") --> B{"make decision"};
    B -- "yes" --> C["perform action"];
    B -- "no" --> D("end");
    C --> D;

    style A fill:#f9f,stroke:#333,stroke-width:2px;
    style D fill:#bbf,stroke:#333,stroke-width:2px,color:#fff;
\`\`\`
`
	}

	const read_0 = 
`- You can use the list_code_definition_names tool to get an overview of source code definitions for all files at the top level of a specified directory. This can be particularly useful when you need to understand the broader context and relationships between certain parts of the code. You may need to call this tool multiple times to understand various parts of the codebase related to the task.
- For example, when asked to make edits or improvements you might analyze the file structure with using list_files tool to get an overview of the project, then use list_code_definition_names to get further insight using source code definitions for files located in relevant directories, then read_file to examine the contents of relevant files, analyze the code and suggest improvements or make necessary edits, then use edit tools to apply the changes. If you refactored code that could affect other parts of the codebase, you could use search_files to ensure you update other files as needed.
- You can use search_files to perform regex searches across files in a specified directory, outputting context-rich results that include surrounding lines. This is particularly useful for understanding code patterns, finding specific implementations, or identifying areas that need refactoring.`
	const computer_use = 
`- You can use the browser_action tool to interact with websites (including html files and locally running development servers) through a Puppeteer-controlled browser when you feel it is necessary in accomplishing the user's task. This tool is particularly useful for web development tasks as it allows you to launch a browser, navigate to pages, interact with elements through clicks and keyboard input, and capture the results through screenshots and console logs. This tool may be useful at key stages of web development tasks-such as after implementing new features, making substantial changes, when troubleshooting issues, or to verify the result of your work. You can analyze the provided screenshots to ensure correct rendering or identify errors, and review console logs for runtime issues.\n  - For example, if asked to add a component to a react website, you might create the necessary files, use execute_command to run the site locally, then use browser_action to launch the browser, navigate to the local server, and verify the component renders & functions correctly before closing the browser.`
	const execute = 
`- You can use the execute_command tool to run commands on the user's computer whenever you feel it can help accomplish the user's task. When you need to execute a CLI command, you must provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, since they are more flexible and easier to run. Interactive and long-running commands are allowed, since the commands are run in the user's VSCode terminal. The user may keep commands running in the background and you will be kept updated on their status along the way. Each command you execute is run in a new terminal instance.`
	const mcp = 
`- You have access to MCP servers that may provide additional tools and resources. Each server may provide different capabilities that you can use to accomplish tasks more effectively.`


	return `====

CAPABILITIES

${tools_group?.includes("read") ? read_0 :""}
${tools_group?.includes("command") ? execute :""}
${tools_group?.includes("mcp") ? mcp :""}
${tools_group?.includes("browser") && supportsComputerUse ? computer_use :""}
- You can directly output the mermaid format flowchart for rendering, in the format like:
\`\`\`mermaid
graph TD
    A("start") --> B{"make decision"};
    B -- "yes" --> C["perform action"];
    B -- "no" --> D("end");
    C --> D;

    style A fill:#f9f,stroke:#333,stroke-width:2px;
    style D fill:#bbf,stroke:#333,stroke-width:2px,color:#fff;
\`\`\`
`
}
