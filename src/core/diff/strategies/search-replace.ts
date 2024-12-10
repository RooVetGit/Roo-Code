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
        
        // Get the exact indentation (preserving tabs/spaces) of each line
        const originalIndents = matchedLines.map(line => {
            const match = line.match(/^[\t ]*/);
            return match ? match[0] : '';
        });
        
        // Get the exact indentation of each line in the search block
        const searchIndents = searchLines.map(line => {
            const match = line.match(/^[\t ]*/);
            return match ? match[0] : '';
        });
        
        // Apply the replacement while preserving exact indentation
        const indentedReplace = replaceLines.map((line, i) => {
            // Get the corresponding original and search indentations
            const originalIndent = originalIndents[Math.min(i, originalIndents.length - 1)];
            const searchIndent = searchIndents[Math.min(i, searchIndents.length - 1)];
            
            // Get the current line's indentation
            const currentIndentMatch = line.match(/^[\t ]*/);
            const currentIndent = currentIndentMatch ? currentIndentMatch[0] : '';
            
            // If this line has the same indentation level as the search block,
            // use the original indentation. Otherwise, calculate the difference
            // and preserve the exact type of whitespace characters
            if (currentIndent.length === searchIndent.length) {
                return originalIndent + line.trim();
            } else {
                // Calculate additional indentation needed
                const additionalIndent = currentIndent.slice(searchIndent.length);
                return originalIndent + additionalIndent + line.trim();
            }
        });
        
        // Construct the final content
        const beforeMatch = originalLines.slice(0, matchIndex);
        const afterMatch = originalLines.slice(matchIndex + searchLines.length);
        
        return [...beforeMatch, ...indentedReplace, ...afterMatch].join('\n');
    }
}