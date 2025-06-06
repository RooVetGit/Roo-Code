import { ToolArgs } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getDeleteLineDescription(args: ToolArgs): string {
	return `
<tool_description>
  <tool_name>delete_line</tool_name>
  <description>Deletes a specific line from a file.</description>
  <parameters>
    <parameter>
      <name>path</name>
      <type>string</type>
      <description>The relative path to the file.</description>
    </parameter>
    <parameter>
      <name>line_number</name>
      <type>integer</type>
      <description>The 1-indexed line number to delete. Must be within the file's line bounds.</description>
    </parameter>
  </parameters>
</tool_description>
`.trim();
}
