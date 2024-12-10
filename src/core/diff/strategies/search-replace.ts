import { DiffStrategy } from "../types"

export class SearchReplaceDiffStrategy implements DiffStrategy {
    getToolDescription(cwd: string): string {
        return `## apply_diff
Description: Request to replace existing code using search and replace blocks.
This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.
Only use this tool when you need to replace/fix existing code.
The tool will maintain proper indentation and formatting while making changes.
Only a single operation is allowed per tool use.
The SEARCH section must exactly match existing content including whitespace and indentation.

Parameters:
- path: (required) The path of the file to modify (relative to the current working directory ${cwd})
- diff: (required) The search/replace blocks defining the changes.

Format:
1. First line must be the file path
2. Followed by search/replace blocks:
   \`\`\`
   <<<<<<< SEARCH
   [exact content to find including whitespace]
   =======
   [new content to replace with]
   >>>>>>> REPLACE
   \`\`\`

Example:

Original file:
\`\`\`
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
\`\`\`

Search/Replace content:
\`\`\`
main.py
<<<<<<< SEARCH
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
=======
def calculate_total(items):
    """Calculate total with 10% markup"""
    return sum(item * 1.1 for item in items)
>>>>>>> REPLACE
\`\`\`

Usage:
<apply_diff>
<path>File path here</path>
<diff>
Your search/replace content here
</diff>
</apply_diff>`
    }

    applyDiff(originalContent: string, diffContent: string): string | false {
        // Extract the search and replace blocks
        const match = diffContent.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
        if (!match) {
            return false;
        }

        const [_, searchContent, replaceContent] = match;
        
        // Split content into lines
        const searchLines = searchContent.trim().split('\n');
        const replaceLines = replaceContent.trim().split('\n');
        const originalLines = originalContent.split('\n');
        
        // Find the search content in the original
        let matchIndex = -1;
        
        for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
            let found = true;
            
            for (let j = 0; j < searchLines.length; j++) {
                const originalLine = originalLines[i + j];
                const searchLine = searchLines[j];
                
                // Compare lines after removing leading/trailing whitespace
                if (originalLine.trim() !== searchLine.trim()) {
                    found = false;
                    break;
                }
            }
            
            if (found) {
                matchIndex = i;
                break;
            }
        }
        
        if (matchIndex === -1) {
            return false;
        }
        
        // Get the matched lines from the original content
        const matchedLines = originalLines.slice(matchIndex, matchIndex + searchLines.length);
        
        // For each line in the match, get its indentation
        const indentations = matchedLines.map(line => {
            const match = line.match(/^(\s*)/);
            return match ? match[1] : '';
        });
        
        // Apply the replacement while preserving indentation
        const indentedReplace = replaceLines.map((line, i) => {
            // Use the indentation from the corresponding line in the matched block
            // If we have more lines than the original, use the last indentation
            const indent = indentations[Math.min(i, indentations.length - 1)];
            return indent + line.trim();
        });
        
        // Construct the final content
        const beforeMatch = originalLines.slice(0, matchIndex);
        const afterMatch = originalLines.slice(matchIndex + searchLines.length);
        
        return [...beforeMatch, ...indentedReplace, ...afterMatch].join('\n');
    }
}
