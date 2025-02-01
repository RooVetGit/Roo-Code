import { ToolArgs } from "./types"

export function getListFilesDescription(args: ToolArgs): string {
	return `<tool_definition>
    <name>list_files</name>
    <description>Lists files and directories in the specified path, returning a JSON structure with file metadata.</description>

    <output_format>
        <json_structure>
            <field>
                <name>name</name>
                <description>File or directory name</description>
            </field>
            <field>
                <name>type</name>
                <description>Either "file" or "directory"</description>
            </field>
            <field>
                <name>extension</name>
                <description>File extension (files only)</description>
            </field>
            <field>
                <name>children</name>
                <description>Nested files/directories (directories only)</description>
            </field>
            <field>
                <name>hasMore</name>
                <description>Indicates if listing was truncated</description>
            </field>
        </json_structure>
    </output_format>

    <parameters>
        <parameter>
            <name>path</name>
            <required>true</required>
            <description>Directory path relative to ${args.cwd}</description>
        </parameter>
        <parameter>
            <name>recursive</name>
            <required>false</required>
            <description>When true, lists contents recursively</description>
        </parameter>
        <parameter>
            <name>format</name>
            <required>false</required>
            <description>Format of the output. Can be "flat" or "tree". Default is "flat"</description>
        </parameter>
    </parameters>

    <syntax_template>
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
<format>"flat" or "tree" (optional)</format>
</list_files>
    </syntax_template>

    <example>
<list_files>
<path>.</path>
<recursive>false</recursive>
<format>tree</format>
</list_files>
    </example>

    <example_output>
{
  "root": {
    "name": "project",
    "type": "directory",
    "children": {
      "src": {
        "name": "src",
        "type": "directory",
        "children": {
          "index.ts": {
            "name": "index",
            "type": "file",
            "extension": ".ts",
          }
        }
      },
      "package.json": {
        "name": "package",
        "type": "file",
        "extension": ".json",
      }
    }
  },
  "hasMore": false
}
    </example_output>
</tool_definition>`
}
