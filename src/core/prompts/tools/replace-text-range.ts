import { ToolArgs } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getReplaceTextRangeDescription(args: ToolArgs): string {
	return `
<tool_description>
  <tool_name>replace_text_range</tool_name>
  <description>Replaces a range of lines in a file with new content. This is the primary tool for all line-level and block-level modifications.
    - To **replace** lines L to M: use start_line=L, end_line=M, and provide the new_content.
    - To **delete** lines L to M: use start_line=L, end_line=M, and provide an empty string for new_content.
    - To **insert** new_content *before* line L: use start_line=L, end_line=L-1, and provide the new_content. (e.g., to insert before line 1, use start_line=1, end_line=0).
    - To **append** new_content *after* the last line (N): use start_line=N+1, end_line=N, and provide new_content.</description>
  <parameters>
    <parameter>
      <name>path</name>
      <type>string</type>
      <description>The relative path to the file.</description>
    </parameter>
    <parameter>
      <name>start_line</name>
      <type>integer</type>
      <description>The 1-indexed line number for the start of the range (inclusive). For insertion before line L, this is L. For appending after the last line N, this is N+1.</description>
    </parameter>
    <parameter>
      <name>end_line</name>
      <type>integer</type>
      <description>The 1-indexed line number for the end of the range (inclusive). For insertion before line L, this is L-1. For appending after the last line N, this is N. For replacing/deleting a single line L, end_line is L.</description>
    </parameter>
    <parameter>
      <name>new_content</name>
      <type>string</type>
      <description>The new content for the specified range. This can be multi-line. For deletion, provide an empty string ("").</description>
    </parameter>
  </parameters>
</tool_description>
`.trim();
}
