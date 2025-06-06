// src/core/processors/CsvProcessor.ts
import fs from "fs/promises";
import path from "path"; // For extracting filename

export class CsvProcessor {
    static async process(filePath: string): Promise<string> {
        const fileName = path.basename(filePath);
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const lines = content.split('\n').filter(Boolean); // Filter out empty lines

            if (lines.length === 0) {
                return `CSV file '${fileName}' is empty.`;
            }

            const headers = lines[0].split(',').map(h => h.trim()); // Trim headers
            const rowCount = lines.length - 1;

            // Perform a simple analysis: find potential anomalies if 'user_id' exists.
            let anomaly_report = "No specific anomalies detected in initial scan.";
            const userIdHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'user_id'); // Case-insensitive search

            if (userIdHeaderIndex !== -1 && rowCount > 0) {
                let missingOrMalformedCount = 0;
                for (let i = 1; i < lines.length; i++) { // Start from 1 to skip header line
                    const row = lines[i].split(',');
                    if (row.length > userIdHeaderIndex) {
                        const userIdValue = row[userIdHeaderIndex]?.trim();
                        if (!userIdValue || userIdValue.length < 3) { // Example: malformed if less than 3 chars
                            missingOrMalformedCount++;
                        }
                    } else {
                        missingOrMalformedCount++; // Row doesn't even have enough columns for user_id
                    }
                }
                if (missingOrMalformedCount > 0) {
                    anomaly_report = `Found column with potential issues: 'user_id'. ${missingOrMalformedCount} out of ${rowCount} rows have missing or potentially malformed 'user_id' values (e.g., empty or < 3 chars).`;
                } else {
                    anomaly_report = "Column 'user_id' checked, no obvious missing or malformed values in initial scan.";
                }
            } else if (userIdHeaderIndex === -1 && rowCount > 0) {
                anomaly_report = "Column 'user_id' not found in CSV headers.";
            } else if (rowCount === 0) {
                anomaly_report = "CSV has headers but no data rows to analyze.";
            }


            return `CSV file '${fileName}' processed.
Headers: ${headers.join(", ")}
Row Count (excluding header): ${rowCount}
Analysis: ${anomaly_report}`;
        } catch (error) {
            // Narrow down error type if possible (e.g. NodeJS.ErrnoException)
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === 'ENOENT') {
                return `Error processing CSV file '${fileName}': File not found at path '${filePath}'.`;
            }
            return `Error processing CSV file '${fileName}': ${nodeError.message}`;
        }
    }
}
