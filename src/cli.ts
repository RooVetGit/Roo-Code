#!/usr/bin/env node
import * as path from 'path';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import {
    ApiConfiguration,
    createApiClient,
    BaseToolExecutor,
    CliContextProvider,
    MessageParser,
    AVAILABLE_TOOLS,
    ToolResponse
} from './lib';

dotenv.config();

class CliToolExecutor extends BaseToolExecutor {
    async executeCommand(command: string): Promise<[boolean, ToolResponse]> {
        return new Promise((resolve) => {
            const process = spawn(command, [], {
                shell: true,
                cwd: this.getCurrentWorkingDirectory()
            });

            let output = '';
            let error = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
                console.log(data.toString());
            });

            process.stderr.on('data', (data) => {
                error += data.toString();
                console.error(data.toString());
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
        apiModelId: 'anthropic/claude-3-sonnet-20240229',
        apiProvider: 'openrouter',
    };

    const cwd = process.cwd();
    const toolExecutor = new CliToolExecutor(cwd);
    const contextProvider = new CliContextProvider(cwd);
    const messageParser = new MessageParser(AVAILABLE_TOOLS);
    const apiClient = createApiClient(apiConfiguration);

    try {
        const envDetails = await contextProvider.getEnvironmentDetails(true);
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
        const history: Anthropic.MessageParam[] = [
            { role: 'user', content: `<task>${task}</task><environment_details>${envDetails}</environment_details>` }
        ];

        console.log('Sending request to API...');
        for await (const chunk of apiClient.createMessage(systemPrompt, history)) {
            if (chunk.type === 'text' && chunk.text) {
                console.log('Received text:', chunk.text);
                const toolUse = messageParser.parseToolUse(chunk.text);
                if (toolUse) {
                    console.log('Parsed tool use:', toolUse);
                }
                if (toolUse) {
                    let error = false;
                    let result = '';
                    
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
                        default:
                            error = true;
                            result = `Unknown tool: ${toolUse.name}`;
                    }
                    history.push(
                        { role: 'assistant', content: chunk.text },
                        { role: 'user', content: `[${toolUse.name}] Result: ${result}` }
                    );
                } else {
                    console.log(chunk.text);
                }
            } else if (chunk.type === 'usage') {
                // Log usage metrics if needed
                // console.log('Usage:', chunk);
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});