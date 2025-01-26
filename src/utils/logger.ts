import * as vscode from 'vscode';

class Logger {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Roo Code');
    }

    info(message: string, ...args: any[]) {
        this.log('INFO', message, ...args);
    }

    error(message: string, ...args: any[]) {
        this.log('ERROR', message, ...args);
    }

    warn(message: string, ...args: any[]) {
        this.log('WARN', message, ...args);
    }

    private log(level: string, message: string, ...args: any[]) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] ${message}`;
        
        if (args.length > 0) {
            this.outputChannel.appendLine(`${formattedMessage} ${JSON.stringify(args)}`);
        } else {
            this.outputChannel.appendLine(formattedMessage);
        }
    }
}

export const logger = new Logger();