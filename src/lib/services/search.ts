import { exec } from 'child_process';
import * as path from 'path';
import * as util from 'util';

const execAsync = util.promisify(exec);

export async function searchFiles(
    cwd: string,
    searchPath: string,
    pattern: string,
    filePattern?: string
): Promise<string> {
    try {
        // Build ripgrep command
        let command = `rg --no-heading --line-number "${pattern}"`;
        if (filePattern) {
            command += ` -g "${filePattern}"`;
        }
        command += ` "${searchPath}"`;

        const { stdout } = await execAsync(command, { cwd });
        return stdout || 'No matches found';
    } catch (error) {
        if (error.code === 1 && !error.stdout) {
            return 'No matches found';
        }
        throw error;
    }
}