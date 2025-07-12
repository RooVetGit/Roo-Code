import React, { memo, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { useCopyToClipboard } from "@src/utils/clipboard"
import { StandardTooltip } from "@src/components/ui"

import MarkdownBlock from "../common/MarkdownBlock"
import { parseTable } from "../common/TableParser"

const splitMarkdownAndTables = (markdownText: string, ts: number) => {
    const segments: { type: 'text' | 'table'; content: string | React.ReactNode }[] = [];
    const lines = markdownText.split(/\r?\n/);
    let currentLineIndex = 0;
    let currentTextBuffer: string[] = [];

    while (currentLineIndex < lines.length) {
        const line = lines[currentLineIndex];
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            const potentialTableLines: string[] = [];
            let tempIndex = currentLineIndex;
            potentialTableLines.push(lines[tempIndex]);
            tempIndex++;
            if (tempIndex < lines.length && lines[tempIndex].trim().match(/^\|(?:\s*[-:]+\s*\|)+\s*$/)) {
                potentialTableLines.push(lines[tempIndex]);
                tempIndex++;
                while (tempIndex < lines.length && lines[tempIndex].trim().startsWith('|') && lines[tempIndex].trim().endsWith('|')) {
                    potentialTableLines.push(lines[tempIndex]);
                    tempIndex++;
                }
                const tableString = potentialTableLines.join('\n');
                const parsedTableContent = parseTable(tableString, `chat-table-${ts}-${segments.length}`);

                if (parsedTableContent) {
                    if (currentTextBuffer.length > 0) {
                        segments.push({ type: 'text', content: currentTextBuffer.join('\n') });
                        currentTextBuffer = [];
                    }
                    segments.push({ type: 'table', content: parsedTableContent });
                    currentLineIndex = tempIndex;
                    continue;
                }
            }
        }
        currentTextBuffer.push(line);
        currentLineIndex++;
    }
    if (currentTextBuffer.length > 0) {
        segments.push({ type: 'text', content: currentTextBuffer.join('\n') });
    }

    return segments;
};

export const Markdown = memo(({ markdown, partial, ts }: { markdown?: string; partial?: boolean; ts?: number }) => {
	const [isHovering, setIsHovering] = useState(false)

	// Shorter feedback duration for copy button flash.
	const { copyWithFeedback } = useCopyToClipboard(200)

	if (!markdown || markdown.length === 0) {
		return null
	}

	const segments = splitMarkdownAndTables(markdown, ts || Date.now());

	return (
		<div
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
			style={{ position: "relative" }}>
			<div style={{ wordBreak: "break-word", overflowWrap: "anywhere", marginBottom: -15, marginTop: -15 }}>
				{segments.map((segment, index) => {
					if (segment.type === 'text') {
						return <MarkdownBlock key={index} markdown={segment.content as string} />;
					} else {
						return <React.Fragment key={index}>{segment.content}</React.Fragment>;
					}
				})}
			</div>
			{markdown && !partial && isHovering && (
				<div
					style={{
						position: "absolute",
						bottom: "-4px",
						right: "8px",
						opacity: 0,
						animation: "fadeIn 0.2s ease-in-out forwards",
						borderRadius: "4px",
					}}>
					<style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1.0; } }`}</style>
					<StandardTooltip content="Copy as markdown">
						<VSCodeButton
							className="copy-button"
							appearance="icon"
							style={{
								height: "24px",
								border: "none",
								background: "var(--vscode-editor-background)",
								transition: "background 0.2s ease-in-out",
							}}
							onClick={async () => {
								const success = await copyWithFeedback(markdown)
								if (success) {
									const button = document.activeElement as HTMLElement
									if (button) {
										button.style.background = "var(--vscode-button-background)"
										setTimeout(() => {
											button.style.background = ""
										}, 200)
									}
								}
							}}>
							<span className="codicon codicon-copy" />
						</VSCodeButton>
					</StandardTooltip>
				</div>
			)}
		</div>
	)
})
