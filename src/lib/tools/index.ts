import { Tool, ToolExecutor, ToolResponse } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { searchFiles } from '../services/search';

export const AVAILABLE_TOOLS: Tool[] = [
    {
        name: 'write_to_file',
        description: 'Write content to a file at the specified path',
        parameters: {
            path: {
                required: true,
                description: 'The path of the file to write to'
            },
            content: {
                required: true,
                description: 'The content to write to the file'
            },
            line_count: {
                required: true,
                description: 'The number of lines in the file'
            }
        }
    },
    {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
            path: {
                required: true,
                description: 'The path of the file to read'
            }
        }
    },
    {
        name: 'list_files',
        description: 'List files in a directory',
        parameters: {
            path: {
                required: true,
                description: 'The path of the directory to list'
            },
            recursive: {
                required: false,
                description: 'Whether to list files recursively'
            }
        }
    },
    {
        name: 'search_files',
        description: 'Search files using regex',
        parameters: {
            path: {
                required: true,
                description: 'The path to search in'
            },
            regex: {
                required: true,
                description: 'The regex pattern to search for'
            },
            file_pattern: {
                required: false,
                description: 'Optional file pattern to filter files'
            }
        }
    }
];

export class BaseToolExecutor implements ToolExecutor {
    constructor(private cwd: string) {}

    async executeCommand(command: string): Promise<[boolean, ToolResponse]> {
        throw new Error('executeCommand must be implemented by platform');
    }

    async writeFile(filePath: string, content: string, lineCount: number): Promise<[boolean, ToolResponse]> {
        try {
            const absolutePath = this.resolvePath(filePath);
            const fileExists = await this.fileExists(absolutePath);
            
            // Create directories if they don't exist
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            
            await fs.writeFile(absolutePath, content);
            
            return [false, `File successfully ${fileExists ? 'updated' : 'created'} at ${filePath}`];
        } catch (error) {
            return [true, `Error writing file: ${error.message}`];
        }
    }

    async readFile(filePath: string): Promise<[boolean, ToolResponse]> {
        try {
            const absolutePath = this.resolvePath(filePath);
            const content = await fs.readFile(absolutePath, 'utf-8');
            return [false, content];
        } catch (error) {
            return [true, `Error reading file: ${error.message}`];
        }
    }

    async listFiles(dirPath: string, recursive: boolean = false): Promise<[boolean, ToolResponse]> {
        try {
            const absolutePath = this.resolvePath(dirPath);
            const files = await this.readDirRecursive(absolutePath, recursive);
            return [false, files.join('\n')];
        } catch (error) {
            return [true, `Error listing files: ${error.message}`];
        }
    }

    async searchFiles(dirPath: string, regex: string, filePattern?: string): Promise<[boolean, ToolResponse]> {
        try {
            const absolutePath = this.resolvePath(dirPath);
            const results = await searchFiles(this.cwd, absolutePath, regex, filePattern);
            return [false, results];
        } catch (error) {
            return [true, `Error searching files: ${error.message}`];
        }
    }

    private async readDirRecursive(dir: string, recursive: boolean): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files: string[] = [];
        
        for (const dirent of dirents) {
            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory() && recursive) {
                files.push(...await this.readDirRecursive(res, recursive));
            } else {
                files.push(path.relative(this.cwd, res));
            }
        }
        
        return files;
    }

    private resolvePath(relativePath: string): string {
        return path.resolve(this.cwd, relativePath);
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}