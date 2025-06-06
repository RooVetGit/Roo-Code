import { ToolArgs } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getReplaceLineDescription(args: ToolArgs): string {
	return `
<tool_description>
  <tool_name>replace_line</tool_name>
  <description>Replaces a specific line in a file with new content. The new content must not contain newline characters.</description>
  <parameters>
    <parameter>
      <name>path</name>
      <type>string</type>
      <description>The relative path to the file.</description>
    </parameter>
    <parameter>
      <name>line_number</name>
      <type>integer</type>
      <description>The 1-indexed line number to replace. Must be within the file's line bounds.</description>
    </parameter>
    <parameter>
      <name>content</name>
      <type>string</type>
      <description>The new content for the line. Must not contain newline characters.</description>
    </parameter>
  </parameters>
</tool_description>
`.trim();
}
