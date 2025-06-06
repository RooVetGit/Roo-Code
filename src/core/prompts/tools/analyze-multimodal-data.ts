import { ToolArgs } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getAnalyzeMultimodalDataDescription(args: ToolArgs): string {
	return `
<tool_description>
  <tool_name>analyze_multimodal_data</tool_name>
  <description>Analyzes content from a list of specified files, supporting various modalities. It can process audio files (wav, mp3) for transcription, CSV files for data analysis, JSON files for validation and snippet extraction, and other files as plain text. The tool returns a consolidated report of its findings for all processed files.</description>
  <parameters>
    <parameter>
      <name>file_paths</name>
      <type>string</type>
      <description>A newline-separated list of relative file paths to analyze (e.g., 'data/report.wav\ndata/stats.csv').</description>
    </parameter>
  </parameters>
</tool_description>
`.trim();
}
