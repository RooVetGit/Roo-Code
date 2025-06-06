import { ToolArgs } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getUndoEditDescription(args: ToolArgs): string {
	return `
<tool_description>
  <tool_name>undo_edit</tool_name>
  <description>Reverts the last approved edit made to a file using Roo's editing tools. If multiple edits were made to the same file, it undoes the most recent one for which history is available.</description>
  <parameters>
    <parameter>
      <name>path</name>
      <type>string</type>
      <description>The relative path to the file to undo an edit for.</description>
    </parameter>
  </parameters>
</tool_description>
`.trim();
}
