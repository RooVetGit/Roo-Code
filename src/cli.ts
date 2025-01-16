#!/usr/bin/env node
import * as path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import {
    ApiConfiguration,
    createApiClient,
    BaseToolExecutor,
    MessageParser,
    AVAILABLE_TOOLS,
    ToolResponse,
    ApiClient
} from './lib';
import { McpClient } from './lib/mcp/McpClient';
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
    const toolsFlag = args.includes('--tools');
    const debugFlag = args.includes('--debug');
    const task = args.find(arg => !['--tools', '--debug'].includes(arg));

    if (!task) {
        console.error('Usage: cline "My Task" [--tools] [--debug]');
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
    const messageParser = new MessageParser(AVAILABLE_TOOLS);
    const apiClient = createApiClient(apiConfiguration);
    const mcpClient = new McpClient();

    // Initialize MCP client early if --tools flag is present
    if (toolsFlag) {
        console.log('Loading available tools...');
        try {
            await mcpClient.initializeServers();
            // Get built-in tools documentation
            const toolDocs = AVAILABLE_TOOLS.map(tool => {
                const params = Object.entries(tool.parameters)
                    .map(([name, param]) => '- ' + name + ': (' + (param.required ? 'required' : 'optional') + ') ' + param.description)
                    .join('\n');
                return '## ' + tool.name + '\nDescription: ' + tool.description + '\nParameters:\n' + params;
            }).join('\n\n');

            // Get MCP server tools
            const mcpTools = [];
            mcpTools.push('\nMCP SERVERS\n');
            mcpTools.push('\nThe Model Context Protocol (MCP) enables communication between the system and locally running MCP servers that provide additional tools and resources to extend your capabilities.\n');
            mcpTools.push('\n# Connected MCP Servers\n');
            mcpTools.push('\nWhen a server is connected, you can use the server\'s tools via the `use_mcp_tool` tool, and access the server\'s resources via the `access_mcp_resource` tool.\n');
            
            // Get list of available servers
            const availableServers = mcpClient.getAvailableServers();

            mcpTools.push(`\nCurrently connected servers: ${availableServers.join(', ') || 'None'}\n`);
            mcpTools.push('\nExample usage:\n');
            mcpTools.push('```xml');
            mcpTools.push('<use_mcp_tool>');
            mcpTools.push('<server_name>mcp-rand</server_name>');
            mcpTools.push('<tool_name>generate_uuid</tool_name>');
            mcpTools.push('<arguments>');
            mcpTools.push('{}');
            mcpTools.push('</arguments>');
            mcpTools.push('</use_mcp_tool>');
            mcpTools.push('```\n');
            
            const serverTools = await mcpClient.getServerTools();
            if (serverTools.length > 0) {
                mcpTools.push(...serverTools);
            } else {
                mcpTools.push('\n(No MCP servers currently connected)');
            }

            console.log('\nAVAILABLE TOOLS\n');
            console.log(toolDocs);
            console.log(mcpTools.filter(Boolean).join(''));
            process.exit(0);
        } catch (error) {
            console.error('Error loading tools:', error);
            process.exit(1);
        }
    }

    try {
        // Initialize MCP servers before starting the task loop
        await mcpClient.initializeServers();
        await initiateTaskLoop(task, toolExecutor, messageParser, apiClient, mcpClient, debugFlag);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

async function initiateTaskLoop(
    task: string,
    toolExecutor: CliToolExecutor,
    messageParser: MessageParser,
    apiClient: ApiClient,
    mcpClient: McpClient,
    debugFlag: boolean
) {
    let history: Anthropic.MessageParam[] = [];
    let includeFileDetails = true;

    while (true) {
        const envDetails = `Current Working Directory: ${process.cwd()}`;
        
        // Get built-in tools documentation
        const toolDocs = AVAILABLE_TOOLS.map(tool => {
            const params = Object.entries(tool.parameters)
                .map(([name, param]) => '- ' + name + ': (' + (param.required ? 'required' : 'optional') + ') ' + param.description)
                .join('\n');
            return '## ' + tool.name + '\nDescription: ' + tool.description + '\nParameters:\n' + params;
        }).join('\n\n');

        // Get MCP server tools
        const mcpTools = [];
        mcpTools.push('\nMCP SERVERS\n');
        mcpTools.push('\nThe Model Context Protocol (MCP) enables communication between the system and locally running MCP servers that provide additional tools and resources to extend your capabilities.\n');
        mcpTools.push('\n# Connected MCP Servers\n');
        mcpTools.push('\nWhen a server is connected, you can use the server\'s tools via the `use_mcp_tool` tool, and access the server\'s resources via the `access_mcp_resource` tool.\n');
        
        // Get list of available servers
        const availableServers = mcpClient.getAvailableServers();

        mcpTools.push(`\nCurrently connected servers: ${availableServers.join(', ') || 'None'}\n`);
        mcpTools.push('\nExample usage:\n');
        mcpTools.push('```xml');
        mcpTools.push('<use_mcp_tool>');
        mcpTools.push('<server_name>mcp-rand</server_name>');
        mcpTools.push('<tool_name>generate_uuid</tool_name>');
        mcpTools.push('<arguments>');
        mcpTools.push('{}');
        mcpTools.push('</arguments>');
        mcpTools.push('</use_mcp_tool>');
        mcpTools.push('```\n');
        
        const serverTools = await mcpClient.getServerTools();
        if (serverTools.length > 0) {
            mcpTools.push(...serverTools);
        } else {
            mcpTools.push('\n(No MCP servers currently connected)');
        }

        // Get the last tool result if any
        const lastMessage = history.length >= 2 ? history[history.length - 1] : null;
        let previousResult: string | null = null;
        
        if (lastMessage && typeof lastMessage.content === 'string') {
            const content = lastMessage.content;
            if (content.startsWith('[') && content.includes('] Result: ')) {
                previousResult = content.substring(content.indexOf('] Result: ') + 9);
            }
        }

        const systemPromptParts = [
            'You are Cline, a highly skilled software engineer.',
            '',
            'TOOLS',
            '',
            'You have access to the following tools that must be used with XML tags:',
            '',
            toolDocs,
            '',
            ...mcpTools.filter(Boolean),
            '',
            'RULES',
            '',
            '1. YOU MUST use exactly one tool in each response. If this is the final response, you must use the `attempt_completion` tool.',
            '2. Wait for tool execution results before proceeding',
            '3. Handle errors appropriately',
            '4. Document your changes',
            '',
            'TASK',
            '',
            task,
            '',
            ...(previousResult ? [
                'PREVIOUS RESULT',
                '',
                previousResult
            ] : [])
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

        if (debugFlag) {
            console.log(chalk.yellow(`[DEBUG] System prompt:\n${systemPrompt}`));
        }

        console.log(chalk.gray('Thinking...'));
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
                    case 'write_to_file': {
                        [error, result] = await toolExecutor.writeFile(
                            toolUse.params.path,
                            toolUse.params.content,
                            parseInt(toolUse.params.line_count)
                        );
                        break;
                    }
                    case 'read_file': {
                        [error, result] = await toolExecutor.readFile(toolUse.params.path);
                        break;
                    }
                    case 'list_files': {
                        const recursive = toolUse.params.recursive === 'true';
                        [error, result] = await toolExecutor.listFiles(
                            toolUse.params.path,
                            recursive
                        );
                        break;
                    }
                    case 'search_files': {
                        [error, result] = await toolExecutor.searchFiles(
                            toolUse.params.path,
                            toolUse.params.regex,
                            toolUse.params.file_pattern
                        );
                        break;
                    }
                    case 'execute_command': {
                        [error, result] = await toolExecutor.executeCommand(toolUse.params.command);
                        break;
                    }
                    case 'attempt_completion': {
                        console.log(chalk.green(toolUse.params.result));
                        if (toolUse.params.command) {
                            [error, result] = await toolExecutor.executeCommand(toolUse.params.command);
                        }
                        // Add result to history before returning
                        if (result) {
                            history.push(
                                { role: 'assistant', content: assistantMessage },
                                { role: 'user', content: `[${toolUse.name}] Result: ${formatToolResponse(result)}` }
                            );
                        }
                        process.exit(0);
                    }
                    case 'list_code_definition_names': {
                        [error, result] = await toolExecutor.listCodeDefinitions(toolUse.params.path);
                        break;
                    }
                    case 'use_mcp_tool': {
                        try {
                            const mcpResult = await mcpClient.callTool(
                                toolUse.params.server_name,
                                toolUse.params.tool_name,
                                JSON.parse(toolUse.params.arguments || '{}')
                            );
                            error = mcpResult.isError === true;
                            result = mcpResult.content.map(item => item.text).join('\n');
                        } catch (err) {
                            error = true;
                            result = `Error executing MCP tool: ${err.message}`;
                        }
                        break;
                    }
                    case 'access_mcp_resource': {
                        try {
                            const mcpResult = await mcpClient.readResource(
                                toolUse.params.server_name,
                                toolUse.params.uri
                            );
                            error = false;
                            result = mcpResult.contents.map(item => item.text).join('\n');
                        } catch (err) {
                            error = true;
                            result = `Error accessing MCP resource: ${err.message}`;
                        }
                        break;
                    }
                    default: {
                        error = true;
                        result = `Unknown tool: ${toolUse.name}`;
                    }
                }
                
                // Mark that we've used a tool and add the result to history
                didAlreadyUseTool = true;
                history.push(
                    { role: 'assistant', content: assistantMessage },
                    { role: 'user', content: `[${toolUse.name}] Result: ${formatToolResponse(result)}` }
                );
                // Log full response in yellow for debugging
                if (debugFlag) {
                    console.log(chalk.yellow(`[DEBUG] Full response:\n${assistantMessage}`));
                }
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
            if (debugFlag) {
                console.log(chalk.yellow(`[DEBUG] Full response:\n${assistantMessage}`));
            }
        }

        // Only include file details in first iteration
        includeFileDetails = false;
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});