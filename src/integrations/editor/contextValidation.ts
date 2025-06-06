import * as Diff from 'diff';

/**
 * Calculates the similarity ratio between two texts based on common characters.
 * Ratio = (2 * commonLength) / (text1.length + text2.length)
 * @param text1 The first text.
 * @param text2 The second text.
 * @returns A number between 0 and 1, where 1 means identical and 0 means completely different.
 */
export function calculateSimilarityRatio(text1: string, text2: string): number {
    if (text1 === null || text1 === undefined || text2 === null || text2 === undefined) {
        return 0; // Or throw an error, depending on desired behavior for null/undefined inputs
    }
    if (text1.length === 0 && text2.length === 0) {
        return 1; // Both empty, considered identical
    }
    if (text1.length === 0 || text2.length === 0) {
        return 0; // One empty, one not, completely different in terms of shared content
    }

    const diffParts = Diff.diffChars(text1, text2);
    let commonLength = 0;

    for (const part of diffParts) {
        if (!part.added && !part.removed) {
            commonLength += part.value.length;
        }
    }

    return (2 * commonLength) / (text1.length + text2.length);
}

/**
 * Validates if the modified content is contextually valid compared to the original content.
 * @param originalContent The original content of the file.
 * @param modifiedContent The proposed modified content.
 * @param contextLines The number of lines at the start and end to check for similarity.
 * @returns True if the context is valid, false otherwise.
 */
export function isContextValid(originalContent: string, modifiedContent: string, contextLines: number = 3): boolean {
    if (originalContent === null || modifiedContent === null || originalContent === undefined || modifiedContent === undefined) {
        // If either is null/undefined, and they are not the same, consider it invalid.
        // If both are null/undefined, calculateSimilarityRatio would handle it, but could be caught here too.
        return originalContent === modifiedContent;
    }

    // Overall Similarity Check
    const overallSimilarity = calculateSimilarityRatio(originalContent, modifiedContent);
    if (overallSimilarity < 0.3) {
        console.warn(`Context validation failed: Overall similarity ${overallSimilarity} < 0.3`);
        return false;
    }

    const originalLines = originalContent.split('\n');
    const modifiedLines = modifiedContent.split('\n');

    // Line Count Check
    // Avoid division by zero if originalLines.length is 0.
    // If original is empty, any addition beyond a few lines might be too much if not handled by overallSimilarity.
    // If originalLines.length is 0, and modifiedLines.length > 0, this check could be problematic.
    // Let's refine: if original is empty, allow up to X lines (e.g. 50) without failing this specific check.
    if (originalLines.length === 0 && modifiedLines.length > 50) { // Arbitrary threshold for new files
         console.warn(`Context validation failed: New file too long ${modifiedLines.length} lines`);
        return false;
    }
    if (originalLines.length > 0 && Math.abs(originalLines.length - modifiedLines.length) > originalLines.length / 2) {
        // Allow some leeway for small files, e.g. if original has 2 lines, diff can be 1 line (50%).
        // This check is more about preventing huge deletions/additions relative to original size.
        if (originalLines.length > 4 && Math.abs(originalLines.length - modifiedLines.length) > 2) { // Stricter for very small files if needed
             console.warn(`Context validation failed: Line count diff too large. Original: ${originalLines.length}, Modified: ${modifiedLines.length}`);
            return false;
        }
    }


    // Start/End Block Similarity Check
    // Only perform if both original and modified have enough lines for context comparison.
    // Also, ensure contextLines is not greater than the number of lines in the shorter of the two.
    const effectiveContextLines = Math.min(contextLines, originalLines.length, modifiedLines.length);

    if (effectiveContextLines > 0) { // Ensure there's something to compare
        const startOriginal = originalLines.slice(0, effectiveContextLines).join('\n');
        const startModified = modifiedLines.slice(0, effectiveContextLines).join('\n');
        const endOriginal = originalLines.slice(-effectiveContextLines).join('\n');
        const endModified = modifiedLines.slice(-effectiveContextLines).join('\n');

        const startSimilarity = calculateSimilarityRatio(startOriginal, startModified);
        const endSimilarity = calculateSimilarityRatio(endOriginal, endModified);

        if (startSimilarity < 0.7 || endSimilarity < 0.7) {
            console.warn(`Context validation failed: Start/End similarity too low. Start: ${startSimilarity}, End: ${endSimilarity}`);
            return false;
        }
    } else if (originalLines.length > 0 && modifiedLines.length > 0 && originalLines.length <= contextLines && modifiedLines.length <= contextLines) {
        // If both files are shorter than contextLines, the whole file is the context.
        // The overallSimilarity check should cover this, but we can be explicit.
        // In this case, effectiveContextLines would be Math.min(originalLines.length, modifiedLines.length).
        // This specific 'else if' might be redundant if effectiveContextLines logic is robust.
        // Let's assume overallSimilarity is sufficient for files shorter than contextLines.
    }


    return true;
}
