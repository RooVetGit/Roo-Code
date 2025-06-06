import { ToolArgs } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getSynthesizeAndPlanDescription(args: ToolArgs): string {
	return `
<tool_description>
  <tool_name>synthesize_and_plan</tool_name>
  <description>Performs a meta-cognitive step to analyze the current situation, goal, conversation history, and workspace state to update the agent's internal 'mental model'. This tool helps when information is insufficient or the goal is ambiguous. It updates the agent's internal synthesis of the problem and generates a new structured plan. The result of this tool is a confirmation that the internal state has been updated; the new plan and synthesis will be part of the agent's context in subsequent steps.</description>
  <parameters>
    <parameter>
      <name>goal</name>
      <type>string</type>
      <description>The current high-level goal or problem the agent is trying to solve or make progress on.</description>
    </parameter>
  </parameters>
</tool_description>
`.trim();
}
