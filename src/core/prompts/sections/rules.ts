import { DiffStrategy } from "../../diff/DiffStrategy"

export interface EditingInstructionsComponents {
	availableTools: string
	insertContentDetail: string
	searchReplaceDetail: string
	preferOtherTools: string
	writeToFileDetail: string
	fullEditingInstructions: string
}

function getEditingInstructions(
	diffStrategy?: DiffStrategy,
	experiments?: Record<string, boolean>,
): EditingInstructionsComponents {
	const instructions: string[] = []
	const availableToolsList: string[] = []

	// Collect available editing tools
	if (diffStrategy) {
		availableToolsList.push(
			"apply_diff (for replacing lines in existing files)",
			"write_to_file (for creating new files or complete file rewrites)",
		)
	} else {
		availableToolsList.push("write_to_file (for creating new files or complete file rewrites)")
	}
	if (experiments?.["insert_content"]) {
		availableToolsList.push("insert_content (for adding lines to existing files)")
	}
	if (experiments?.["search_and_replace"]) {
		availableToolsList.push("search_and_replace (for finding and replacing individual pieces of text)")
	}

	const availableTools =
		availableToolsList.length > 1
			? `- For editing files, you have access to these tools: ${availableToolsList.join(", ")}.`
			: ""
	if (availableTools) instructions.push(availableTools)

	const insertContentDetail = experiments?.["insert_content"]
		? "- The insert_content tool adds lines of text to files, such as adding a new function to a JavaScript file or inserting a new route in a Python file. This tool will insert it at the specified line location. It can support multiple operations at once."
		: ""
	if (insertContentDetail) instructions.push(insertContentDetail)

	const searchReplaceDetail = experiments?.["search_and_replace"]
		? "- The search_and_replace tool finds and replaces text or regex in files. This tool allows you to search for a specific regex pattern or text and replace it with another value. Be cautious when using this tool to ensure you are replacing the correct text. It can support multiple operations at once."
		: ""
	if (searchReplaceDetail) instructions.push(searchReplaceDetail)

	const preferOtherTools =
		availableToolsList.length > 1
			? "- You should always prefer using other editing tools over write_to_file when making changes to existing files since write_to_file is much slower and cannot handle large files."
			: ""
	if (preferOtherTools) instructions.push(preferOtherTools)

	const writeToFileDetail =
		"- When using the write_to_file tool to modify a file, use the tool directly with the desired content. You do not need to display the content before using the tool. ALWAYS provide the COMPLETE file content in your response. This is NON-NEGOTIABLE. Partial updates or placeholders like '// rest of code unchanged' are STRICTLY FORBIDDEN. You MUST include ALL parts of the file, even if they haven't been modified. Failure to do so will result in incomplete or broken code, severely impacting the user's project."
	instructions.push(writeToFileDetail)

	return {
		availableTools,
		insertContentDetail,
		searchReplaceDetail,
		preferOtherTools,
		writeToFileDetail,
		fullEditingInstructions: instructions.join("\n"),
	}
}

export interface RulesComponents extends EditingInstructionsComponents {
	baseDir: string
	relativePaths: string
	noCd: string
	noHomeChar: string
	executeCommandContext: string
	searchFilesUsage: string
	newProjectStructure: string
	modeRestrictions: string
	projectContext: string
	codeChangeContext: string
	minimizeQuestions: string
	askFollowupUsage: string
	executeCommandOutput: string
	userProvidedContent: string
	goalOriented: string
	browserActionUsage: string
	noConversationalEndings: string
	noConversationalStarters: string
	imageUsage: string
	envDetailsUsage: string
	activeTerminals: string
	mcpOperations: string
	waitForConfirmation: string
	fullSection: string
}

export function getRulesSection(
	cwd: string,
	supportsComputerUse: boolean,
	diffStrategy?: DiffStrategy,
	experiments?: Record<string, boolean> | undefined,
): RulesComponents {
	const posixCwd = cwd.toPosix()
	const editingTools = diffStrategy ? "apply_diff or write_to_file" : "write_to_file"

	const baseDir = `- The project base directory is: ${posixCwd}`
	const relativePaths = `- All file paths must be relative to this directory. However, commands may change directories in terminals, so respect working directory specified by the response to <execute_command>.`
	const noCd = `- You cannot \`cd\` into a different directory to complete a task. You are stuck operating from '${posixCwd}', so be sure to pass in the correct 'path' parameter when using tools that require a path.`
	const noHomeChar = `- Do not use the ~ character or $HOME to refer to the home directory.`
	const executeCommandContext = `- Before using the execute_command tool, you must first think about the SYSTEM INFORMATION context provided to understand the user's environment and tailor your commands to ensure they are compatible with their system. You must also consider if the command you need to run should be executed in a specific directory outside of the current working directory '${posixCwd}', and if so prepend with \`cd\`'ing into that directory && then executing the command (as one command since you are stuck operating from '${posixCwd}'). For example, if you needed to run \`npm install\` in a project outside of '${posixCwd}', you would need to prepend with a \`cd\` i.e. pseudocode for this would be \`cd (path to project) && (command, in this case npm install)\`.`
	const searchFilesUsage = `- When using the search_files tool, craft your regex patterns carefully to balance specificity and flexibility. Based on the user's task you may use it to find code patterns, TODO comments, function definitions, or any text-based information across the project. The results include context, so analyze the surrounding code to better understand the matches. Leverage the search_files tool in combination with other tools for more comprehensive analysis. For example, use it to find specific code patterns, then use read_file to examine the full context of interesting matches before using ${editingTools} to make informed changes.`
	const newProjectStructure = `- When creating a new project (such as an app, website, or any software project), organize all new files within a dedicated project directory unless the user specifies otherwise. Use appropriate file paths when writing files, as the write_to_file tool will automatically create any necessary directories. Structure the project logically, adhering to best practices for the specific type of project being created. Unless otherwise specified, new projects should be easily run without additional setup, for example most projects can be built in HTML, CSS, and JavaScript - which you can open in a browser.`
	const editingInstructions = getEditingInstructions(diffStrategy, experiments)
	const modeRestrictions = `- Some modes have restrictions on which files they can edit. If you attempt to edit a restricted file, the operation will be rejected with a FileRestrictionError that will specify which file patterns are allowed for the current mode.\n  * For example, in architect mode trying to edit app.js would be rejected because architect mode can only edit files matching "\\.md$"`
	const projectContext = `- Be sure to consider the type of project (e.g. Python, JavaScript, web application) when determining the appropriate structure and files to include. Also consider what files may be most relevant to accomplishing the task, for example looking at a project's manifest file would help you understand the project's dependencies, which you could incorporate into any code you write.`
	const codeChangeContext = `- When making changes to code, always consider the context in which the code is being used. Ensure that your changes are compatible with the existing codebase and that they follow the project's coding standards and best practices.`
	const minimizeQuestions = `- Do not ask for more information than necessary. Use the tools provided to accomplish the user's request efficiently and effectively. When you've completed your task, you must use the attempt_completion tool to present the result to the user. The user may provide feedback, which you can use to make improvements and try again.`
	const askFollowupUsage = `- You are only allowed to ask the user questions using the ask_followup_question tool. Use this tool only when you need additional details to complete a task, and be sure to use a clear and concise question that will help you move forward with the task. When you ask a question, provide the user with 2-4 suggested answers based on your question so they don't need to do so much typing. The suggestions should be specific, actionable, and directly related to the completed task. They should be ordered by priority or logical sequence. However if you can use the available tools to avoid having to ask the user questions, you should do so. For example, if the user mentions a file that may be in an outside directory like the Desktop, you should use the list_files tool to list the files in the Desktop and check if the file they are talking about is there, rather than asking the user to provide the file path themselves.`
	const executeCommandOutput = `- When executing commands, if you don't see the expected output, assume the terminal executed the command successfully and proceed with the task. The user's terminal may be unable to stream the output back properly. If you absolutely need to see the actual terminal output, use the ask_followup_question tool to request the user to copy and paste it back to you.`
	const userProvidedContent = `- The user may provide a file's contents directly in their message, in which case you shouldn't use the read_file tool to get the file contents again since you already have it.`
	const goalOriented = `- Your goal is to try to accomplish the user's task, NOT engage in a back and forth conversation.`
	const browserActionUsage = supportsComputerUse
		? `- The user may ask generic non-development tasks, such as "what's the latest news" or "look up the weather in San Diego", in which case you might use the browser_action tool to complete the task if it makes sense to do so, rather than trying to create a website or using curl to answer the question. However, if an available MCP server tool or resource can be used instead, you should prefer to use it over browser_action.`
		: ""
	const noConversationalEndings = `- NEVER end attempt_completion result with a question or request to engage in further conversation! Formulate the end of your result in a way that is final and does not require further input from the user.`
	const noConversationalStarters = `- You are STRICTLY FORBIDDEN from starting your messages with "Great", "Certainly", "Okay", "Sure". You should NOT be conversational in your responses, but rather direct and to the point. For example you should NOT say "Great, I've updated the CSS" but instead something like "I've updated the CSS". It is important you be clear and technical in your messages.`
	const imageUsage = `- When presented with images, utilize your vision capabilities to thoroughly examine them and extract meaningful information. Incorporate these insights into your thought process as you accomplish the user's task.`
	const envDetailsUsage = `- At the end of each user message, you will automatically receive environment_details. This information is not written by the user themselves, but is auto-generated to provide potentially relevant context about the project structure and environment. While this information can be valuable for understanding the project context, do not treat it as a direct part of the user's request or response. Use it to inform your actions and decisions, but don't assume the user is explicitly asking about or referring to this information unless they clearly do so in their message. When using environment_details, explain your actions clearly to ensure the user understands, as they may not be aware of these details.`
	const activeTerminals = `- Before executing commands, check the "Actively Running Terminals" section in environment_details. If present, consider how these active processes might impact your task. For example, if a local development server is already running, you wouldn't need to start it again. If no active terminals are listed, proceed with command execution as normal.`
	const mcpOperations = `- MCP operations should be used one at a time, similar to other tool usage. Wait for confirmation of success before proceeding with additional operations.`
	const waitForConfirmation = `- It is critical you wait for the user's response after each tool use, in order to confirm the success of the tool use. For example, if asked to make a todo app, you would create a file, wait for the user's response it was created successfully, then create another file if needed, wait for the user's response it was created successfully, etc.${
		supportsComputerUse
			? " Then if you want to test your work, you might use browser_action to launch the site, wait for the user's response confirming the site was launched along with a screenshot, then perhaps e.g., click a button to test functionality if needed, wait for the user's response confirming the button was clicked along with a screenshot of the new state, before finally closing the browser."
			: ""
	}`

	const allRules = [
		baseDir,
		relativePaths,
		noCd,
		noHomeChar,
		executeCommandContext,
		searchFilesUsage,
		newProjectStructure,
		editingInstructions.fullEditingInstructions,
		modeRestrictions,
		projectContext,
		codeChangeContext,
		minimizeQuestions,
		askFollowupUsage,
		executeCommandOutput,
		userProvidedContent,
		goalOriented,
		browserActionUsage,
		noConversationalEndings,
		noConversationalStarters,
		imageUsage,
		envDetailsUsage,
		activeTerminals,
		mcpOperations,
		waitForConfirmation,
	]
		.filter(Boolean) // Remove empty strings (like browserActionUsage if false)
		.join("\n")

	const fullSection = `====

RULES

${allRules}`

	return {
		baseDir,
		relativePaths,
		noCd,
		noHomeChar,
		executeCommandContext,
		searchFilesUsage,
		newProjectStructure,
		...editingInstructions, // Spread editing components
		modeRestrictions,
		projectContext,
		codeChangeContext,
		minimizeQuestions,
		askFollowupUsage,
		executeCommandOutput,
		userProvidedContent,
		goalOriented,
		browserActionUsage,
		noConversationalEndings,
		noConversationalStarters,
		imageUsage,
		envDetailsUsage,
		activeTerminals,
		mcpOperations,
		waitForConfirmation,
		fullSection,
	}
}
