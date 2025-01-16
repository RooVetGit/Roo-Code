import { ContextProvider } from '../types';
import * as path from 'path';
import { listFiles } from '../../services/glob/list-files';
import { formatResponse } from '../../core/prompts/responses';
import { arePathsEqual } from '../../utils/path';
import os from 'os';

export class BaseContextProvider implements ContextProvider {
    constructor(
        protected cwd: string,
        protected state: {
            mode?: string;
            mcpEnabled?: boolean;
            alwaysApproveResubmit?: boolean;
            requestDelaySeconds?: number;
            browserViewportSize?: { width: number; height: number };
            preferredLanguage?: string;
            customPrompts?: Record<string, string>;
        } = {}
    ) {}

    getCurrentWorkingDirectory(): string {
        return this.cwd;
    }

    async getState() {
        return {
            mode: this.state.mode ?? 'code',
            mcpEnabled: this.state.mcpEnabled ?? true,
            alwaysApproveResubmit: this.state.alwaysApproveResubmit ?? false,
            requestDelaySeconds: this.state.requestDelaySeconds ?? 5,
            browserViewportSize: this.state.browserViewportSize ?? { width: 900, height: 600 },
            preferredLanguage: this.state.preferredLanguage,
            customPrompts: this.state.customPrompts ?? {},
        };
    }

    async getEnvironmentDetails(includeFileDetails: boolean = false): Promise<string> {
        let details = "";

        // Add current time information with timezone
        const now = new Date();
        const formatter = new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        });
        const timeZone = formatter.resolvedOptions().timeZone;
        const timeZoneOffset = -now.getTimezoneOffset() / 60;
        const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? '+' : ''}${timeZoneOffset}:00`;
        details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`;

        // Add current mode
        const { mode } = await this.getState();
        details += `\n\n# Current Mode\n${mode}`;

        // Add file details if requested
        if (includeFileDetails) {
            details += `\n\n# Current Working Directory (${this.cwd}) Files\n`;
            const isDesktop = arePathsEqual(this.cwd, path.join(os.homedir(), "Desktop"));
            
            if (isDesktop) {
                details += "(Desktop files not shown automatically. Use list_files to explore if needed.)";
            } else {
                const [files, didHitLimit] = await listFiles(this.cwd, true, 200);
                const result = formatResponse.formatFilesList(this.cwd, files, didHitLimit);
                details += result;
            }
        }

        return `<environment_details>\n${details.trim()}\n</environment_details>`;
    }
}

export class CliContextProvider extends BaseContextProvider {
    // CLI-specific context enhancements can be added here
}

export class VsCodeContextProvider extends BaseContextProvider {
    constructor(
        cwd: string,
        state: any,
        private vscode: any
    ) {
        super(cwd, state);
    }

    async getEnvironmentDetails(includeFileDetails: boolean = false): Promise<string> {
        let details = await super.getEnvironmentDetails(includeFileDetails);

        // Add VSCode-specific details
        let vsCodeDetails = "";

        // Add visible files
        vsCodeDetails += "\n\n# VSCode Visible Files";
        const visibleFiles = this.vscode.window.visibleTextEditors
            ?.map((editor: any) => editor.document?.uri?.fsPath)
            .filter(Boolean)
            .map((absolutePath: string) => path.relative(this.cwd, absolutePath))
            .join("\n");
        
        if (visibleFiles) {
            vsCodeDetails += `\n${visibleFiles}`;
        } else {
            vsCodeDetails += "\n(No visible files)";
        }

        // Add open tabs
        vsCodeDetails += "\n\n# VSCode Open Tabs";
        const openTabs = this.vscode.window.tabGroups.all
            .flatMap((group: any) => group.tabs)
            .map((tab: any) => tab.input?.uri?.fsPath)
            .filter(Boolean)
            .map((absolutePath: string) => path.relative(this.cwd, absolutePath))
            .join("\n");
        
        if (openTabs) {
            vsCodeDetails += `\n${openTabs}`;
        } else {
            vsCodeDetails += "\n(No open tabs)";
        }

        // Insert VSCode details at the start of the environment details
        details = details.replace(
            '<environment_details>\n',
            `<environment_details>${vsCodeDetails}`
        );

        return details;
    }
}