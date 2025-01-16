#!/usr/bin/env node
import * as path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import {
    ApiConfiguration,
    createApiClient,
    BaseToolExecutor,
    CliContextProvider,
    MessageParser,
    AVAILABLE_TOOLS,
    ToolResponse,
    ApiClient
} from './lib';
import { Anthropic } from '@anthropic-ai/sdk';

function formatToolResponse(response: ToolResponse): string {
    return Array.isArray(response) ? JSON.stringify(response) : response;
}

class CliToolExecutor extends BaseToolExecutor {
    override async executeCommand(command: string): Promise<[boolean, ToolResponse]> {
        return new Promise((resolve) => {
            const process = spawn(command, [], {
                shell: true,
                cwd: this.getCurrentWorkingDirectory()
            });

            let output = '';
            let error = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                error += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    resolve([true, 'Command failed with code ' + code + '\n' + error]);
                } else {
                    resolve([false, output]);
                }
            });
        });
    }

    getCurrentWorkingDirectory(): string {
        return process.cwd();
    }
}

async function main() {
    const args = process.argv.slice(2);
    const task = args[0];

    if (!task) {
        console.error('Usage: cline "My Task" [--tools]');
        process.exit(1);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('Error: OPENROUTER_API_KEY environment variable is required');
        process.exit(1);
    }

    const apiConfiguration: ApiConfiguration = {
        apiKey,
        apiModelId: 'anthropic/claude-3.5-sonnet',
        apiProvider: 'openrouter',
    };

    const cwd = process.cwd();
    const toolExecutor = new CliToolExecutor(cwd);
    const contextProvider = new CliContextProvider(cwd);
    const messageParser = new MessageParser(AVAILABLE_TOOLS);
    const apiClient = createApiClient(apiConfiguration);

    try {
        await initiateTaskLoop(task, toolExecutor, contextProvider, messageParser, apiClient);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

async function initiateTaskLoop(
    task: string,
    toolExecutor: CliToolExecutor,
    contextProvider: CliContextProvider,
    messageParser: MessageParser,
    apiClient: ApiClient
) {
    let history: Anthropic.MessageParam[] = [];
    let includeFileDetails = true;

    while (true) {
        const envDetails = await contextProvider.getEnvironmentDetails(includeFileDetails);
        const toolDocs = AVAILABLE_TOOLS.map(tool => {
            const params = Object.entries(tool.parameters)
                .map(([name, param]) => '- ' + name + ': (' + (param.required ? 'required' : 'optional') + ') ' + param.description)
                .join('\n');
            return '## ' + tool.name + '\nDescription: ' + tool.description + '\nParameters:\n' + params;
        }).join('\n\n');

        const systemPromptParts = [
            'You are Cline, a highly skilled software engineer.',
            '',
            'TOOLS',
            '',
            'You have access to the following tools that must be used with XML tags:',
            '',
            toolDocs,
            '',
            'RULES',
            '',
            '1. Use one tool at a time',
            '2. Wait for tool execution results before proceeding',
            '3. Handle errors appropriately',
            '4. Document your changes',
            '',
            'TASK',
            '',
            task
        ];

        const systemPrompt = systemPromptParts.join('\n');
        
        // Only add task and environment details on first iteration
        if (history.length === 0) {
            history.push({
                role: 'user',
                content: `<task>${task}</task><environment_details>${envDetails}</environment_details>`
            });
        }

        let didUseToolInResponse = false;
        let didAlreadyUseTool = false;
        let assistantMessage = '';

        console.log(chalk.yellow(`[DEBUG] System prompt:\n${systemPrompt}`));
        for await (const chunk of apiClient.createMessage(systemPrompt, history)) {
            if (chunk.type === 'text' && chunk.text) {
                assistantMessage += chunk.text;
                
                const toolUse = messageParser.parseToolUse(chunk.text);
                if (!toolUse) continue;
                didUseToolInResponse = true;

                if (didAlreadyUseTool) {
                    // Skip executing additional tools after the first one
                    history.push(
                        { role: 'assistant', content: assistantMessage },
                        { role: 'user', content: `Tool [${toolUse.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.` }
                    );
                    continue;
                }

                let error = false;
                let result: ToolResponse = '';
                
                switch (toolUse.name) {
                    case 'write_to_file':
                        [error, result] = await toolExecutor.writeFile(
                            toolUse.params.path,
                            toolUse.params.content,
                            parseInt(toolUse.params.line_count)
                        );
                        break;
                    case 'read_file':
                        [error, result] = await toolExecutor.readFile(toolUse.params.path);
                        break;
                    case 'list_files':
                        [error, result] = await toolExecutor.listFiles(
                            toolUse.params.path,
                            toolUse.params.recursive === 'true'
                        );
                        break;
                    case 'search_files':
                        [error, result] = await toolExecutor.searchFiles(
                            toolUse.params.path,
                            toolUse.params.regex,
                            toolUse.params.file_pattern
                        );
                        break;
                    case 'execute_command':
                        [error, result] = await toolExecutor.executeCommand(toolUse.params.command);
                        break;
                    case 'attempt_completion':
                        console.log(chalk.green(toolUse.params.result));
                        if (toolUse.params.command) {
                            [error, result] = await toolExecutor.executeCommand(toolUse.params.command);
                        }
                        return;
                    case 'list_code_definition_names':
                        [error, result] = await toolExecutor.listCodeDefinitions(toolUse.params.path);
                        break;
                    default:
                        error = true;
                        result = `Unknown tool: ${toolUse.name}`;
                }
                
                // Mark that we've used a tool and add the result to history
                didAlreadyUseTool = true;
                history.push(
                    { role: 'assistant', content: assistantMessage },
                    { role: 'user', content: `[${toolUse.name}] Result: ${formatToolResponse(result)}` }
                );
                // Log full response in yellow for debugging
                console.log(chalk.yellow(`[DEBUG] Full response:\n${assistantMessage}`));
                continue;
            }
        }

        // If no tool was used, prompt the assistant to either use a tool or attempt completion
        if (!didUseToolInResponse && assistantMessage) {
            history.push(
                { role: 'assistant', content: assistantMessage },
                { role: 'user', content: 'You responded with only text but have not called attempt_completion yet. Please either use a tool to proceed with the task or call attempt_completion if the task is complete.' }
            );
            // Log full response in yellow for debugging
            console.log(chalk.yellow(`[DEBUG] Full response:\n${assistantMessage}`));
        }

        // Only include file details in first iteration
        includeFileDetails = false;
    }
}
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});