/**
 * Performs a block edit operation on a string representing file content.
 * It can replace a block of lines or insert new lines if startLine1Indexed > endLine1Indexed.
 *
 * @param originalContent The original content of the file as a string.
 * @param startLine1Indexed The 1-indexed start line of the block to replace or the line to insert before.
 * @param endLine1Indexed The 1-indexed end line of the block to replace. For insertion, this should be startLine1Indexed - 1.
 * @param newBlockContent The new content to replace the block with or to insert, as a string (can be multi-line).
 * @returns The modified content as a string.
 *
 * @example
 * const content = "line1\nline2\nline3\nline4\nline5";
 *
 * // Replace a middle block (lines 2-3 with "newlineA\newlineB")
 * safeBlockEdit(content, 2, 3, "newlineA\nnewlineB");
 * // Result: "line1\nnewlineA\nnewlineB\nline4\nline5"
 *
 * // Replace from the beginning (lines 1-2)
 * safeBlockEdit(content, 1, 2, "newStart");
 * // Result: "newStart\nline3\nline4\nline5"
 *
 * // Replace until the end (lines 4-5)
 * safeBlockEdit(content, 4, 5, "newEnd");
 * // Result: "line1\nline2\nline3\nnewEnd"
 *
 * // Replace the entire file (lines 1-5)
 * safeBlockEdit(content, 1, 5, "whole new content");
 * // Result: "whole new content"
 *
 * // Insert at the beginning (insert before line 1)
 * safeBlockEdit(content, 1, 0, "inserted at start");
 * // Result: "inserted at start\nline1\nline2\nline3\nline4\nline5"
 *
 * // Insert in the middle (insert before line 3)
 * safeBlockEdit(content, 3, 2, "inserted mid");
 * // Result: "line1\nline2\ninserted mid\nline3\nline4\nline5"
 *
 * // Insert at the end (insert after line 5, i.e., before hypothetical line 6)
 * safeBlockEdit(content, 6, 5, "inserted at end");
 * // Result: "line1\nline2\nline3\nline4\nline5\ninserted at end"
 *
 * // Delete a block (replace lines 2-3 with nothing)
 * safeBlockEdit(content, 2, 3, "");
 * // Result: "line1\nline4\nline5"
 *
 * // Operate on an empty originalContent
 * safeBlockEdit("", 1, 0, "new file content");
 * // Result: "new file content"
 *
 * // Replace content of a single-line file
 * safeBlockEdit("only one line", 1, 1, "replaced line");
 * // Result: "replaced line"
 *
 * // Insert into an empty file (special case of originalContent === "")
 * safeBlockEdit("", 1, 0, "hello"); // -> "hello"
 *
 * // Replace an empty file (start=1, end=0 makes it an insert before line 1)
 * // To replace "empty" content, if file has one empty line, use start=1, end=1
 * safeBlockEdit("", 1, 1, "world"); // -> "world" (conceptually replacing the "empty" file)
 * safeBlockEdit("\n", 1, 2, "test"); // -> "test" (replacing two empty lines)
 */
export function safeBlockEdit(
    originalContent: string,
    startLine1Indexed: number,
    endLine1Indexed: number,
    newBlockContent: string
): string {
    const originalLines: string[] = originalContent.split('\n');
    const newBlockLines: string[] = newBlockContent.split('\n');

    // Handle totally empty originalContent specifically to avoid issues with split producing ['']
    if (originalContent === "") {
        // If original is empty, any "replacement" is just the new content.
        // Insertion (e.g. start=1, end=0) or "replacing" a non-existent line 1 (start=1, end=1)
        // all result in just returning the new block.
        return newBlockContent;
    }

    let startIndex0 = startLine1Indexed - 1;
    let endIndex0 = endLine1Indexed - 1;

    // Normalize startIndex0 to be at least 0
    startIndex0 = Math.max(0, startIndex0);

    let headLines: string[];
    let tailLines: string[];

    if (startIndex0 > endIndex0) {
        // Insertion case: e.g., startLine=5, endLine=4 means insert before 0-indexed line 4.
        // Or startLine=1, endLine=0 means insert before 0-indexed line 0.
        headLines = originalLines.slice(0, startIndex0);
        tailLines = originalLines.slice(startIndex0);
    } else {
        // Replacement case: startIndex0 <= endIndex0
        // Replace lines from startIndex0 up to and including endIndex0.
        headLines = originalLines.slice(0, startIndex0);
        tailLines = originalLines.slice(endIndex0 + 1);
    }

    const resultLines = [...headLines, ...newBlockLines, ...tailLines];

    // If the result is a single empty string element, it means the new content was effectively empty
    // and it replaced everything, or inserted into an empty file.
    if (resultLines.length === 1 && resultLines[0] === "") {
        return "";
    }

    return resultLines.join('\n');
}
