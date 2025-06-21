import { MultiFileSearchReplaceDiffStrategy } from "../multi-file-search-replace"
import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("Diff Strategy Timeout Protection", () => {
	const multiFileStrategy = new MultiFileSearchReplaceDiffStrategy()
	const singleFileStrategy = new MultiSearchReplaceDiffStrategy()

	// Create a complex XML-like content that could cause regex backtracking
	const problematicXMLContent = `
<configuration>
	<section name="complex">
		<subsection>
			<item>value1</item>
			<item>value2</item>
			<nested>
				<deeply>
					<more>content</more>
					<more>content</more>
					<more>content</more>
				</deeply>
			</nested>
		</subsection>
	</section>
	<!-- More complex nested structures -->
	<section name="another">
		<subsection>
			<item>value3</item>
			<nested>
				<deeply>
					<more>content</more>
				</deeply>
			</nested>
		</subsection>
	</section>
</configuration>
`.repeat(10) // Repeat to make it larger

	// Real-world problematic XML content from the user
	const realWorldProblematicXML = `<workflow>
  <step number="1">
    <name>Determine Issue Type</name>
    <instructions>
      Use ask_followup_question to determine if the user wants to create:
      
      <ask_followup_question>
      <question>What type of issue would you like to create?</question>
      <follow_up>
      <suggest>Bug Report - Report a problem with existing functionality</suggest>
      <suggest>Detailed Feature Proposal - Propose a new feature or enhancement</suggest>
      </follow_up>
      </ask_followup_question>
    </instructions>
  </step>

  <step number="2">
    <name>Gather Initial Information</name>
    <instructions>
      Based on the user's initial prompt or request, extract key information.
      If the user hasn't provided enough detail, use ask_followup_question to gather
      the required fields from the appropriate template.
      
      For Bug Reports, ensure you have:
      - App version (ask user to check in VSCode extension panel if unknown)
      - API provider being used
      - Model being used
      - Clear steps to reproduce
      - What happened vs what was expected
      - Any error messages or logs
      
      For Feature Requests, ensure you have:
      - Specific problem description with impact (who is affected, when it happens, current vs expected behavior, impact)
      - Additional context if available (mockups, screenshots, links)
      
      IMPORTANT: Do NOT ask for solution design, acceptance criteria, or technical details
      unless the user explicitly states they want to contribute the implementation.
      
      Use multiple ask_followup_question calls if needed to gather all information.
      Be specific in your questions based on what's missing.
    </instructions>
  </step>
</workflow>`

	// More deeply nested XML to test extreme cases
	const deeplyNestedXML =
		Array(15)
			.fill(0)
			.map(
				(_, i) => `
    <level${i}>
      <data attr="value${i}">
        <![CDATA[Complex content with special chars: < > & " ']]>
      </data>
      ${i < 14 ? "" : "<content>Final content</content>"}
    `,
			)
			.join("") +
		Array(15)
			.fill(0)
			.map((_, i) => `</level${14 - i}>`)
			.join("")

	const validDiffContent = `
<<<<<<< SEARCH
:start_line:1
-------
<configuration>
	<section name="complex">
=======
<configuration>
	<section name="updated">
>>>>>>> REPLACE
`

	const invalidComplexDiffContent = `
<<<<<<< SEARCH
:start_line:1
-------
${problematicXMLContent}
=======
updated content
>>>>>>> REPLACE
`.repeat(5) // Multiple diff blocks

	it("should handle valid diff content without hanging (MultiFileSearchReplaceDiffStrategy)", async () => {
		const result = await multiFileStrategy.applyDiff(problematicXMLContent, validDiffContent)
		expect(result.success).toBe(true)
	}, 10000) // 10 second timeout for test

	it("should handle valid diff content without hanging (MultiSearchReplaceDiffStrategy)", async () => {
		const result = await singleFileStrategy.applyDiff(problematicXMLContent, validDiffContent)
		expect(result.success).toBe(true)
	}, 10000) // 10 second timeout for test

	it("should timeout and fail gracefully with complex content (MultiFileSearchReplaceDiffStrategy)", async () => {
		// Use a very short timeout to test the timeout mechanism
		const strategy = new MultiFileSearchReplaceDiffStrategy(1.0, 40, 100) // 100ms timeout

		const result = await strategy.applyDiff(problematicXMLContent, invalidComplexDiffContent)

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toContain("timed out")
			expect(result.error).toContain("regex timeout")
		}
	}, 5000)

	it("should timeout and fail gracefully with complex content (MultiSearchReplaceDiffStrategy)", async () => {
		// Use a very short timeout to test the timeout mechanism
		const strategy = new MultiSearchReplaceDiffStrategy(1.0, 40, 100) // 100ms timeout

		const result = await strategy.applyDiff(problematicXMLContent, invalidComplexDiffContent)

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toContain("timed out")
			expect(result.error).toContain("regex timeout")
		}
	}, 5000)

	it("should successfully parse well-formed diff blocks with new parser", async () => {
		const wellFormedDiff = `
<<<<<<< SEARCH
:start_line:2
-------
	<section name="complex">
		<subsection>
=======
	<section name="updated">
		<subsection>
>>>>>>> REPLACE

<<<<<<< SEARCH
:start_line:10
-------
			<item>value1</item>
			<item>value2</item>
=======
			<item>updated1</item>
			<item>updated2</item>
>>>>>>> REPLACE
`

		const result = await multiFileStrategy.applyDiff(problematicXMLContent, wellFormedDiff)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toContain("updated")
		}
	}, 10000)

	it("should handle escaped markers correctly", async () => {
		const diffWithEscapedMarkers = `
<<<<<<< SEARCH
:start_line:1
-------
<configuration>
	\\<<<<<<< This is escaped content
	\\======= Also escaped
	\\>>>>>>> REPLACE And this too
</configuration>
=======
<configuration>
	<<<<<<< This is escaped content
	======= Also escaped
	>>>>>>> REPLACE And this too
</configuration>
>>>>>>> REPLACE
`

		const originalContent = `<configuration>
	\\<<<<<<< This is escaped content
	\\======= Also escaped
	\\>>>>>>> REPLACE And this too
</configuration>`

		const result = await multiFileStrategy.applyDiff(originalContent, diffWithEscapedMarkers)
		console.log("Result:", result)
		if (!result.success) {
			console.log("Error:", result.error)
		}
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).not.toContain("\\<<<<<<<")
		}
	}, 5000)

	it("should handle real-world problematic XML content without hanging", async () => {
		const diffContent = [
			"<<<<<<< SEARCH",
			":start_line:1",
			"-------",
			"<workflow>",
			'  <step number="1">',
			"    <name>Determine Issue Type</name>",
			"=======",
			"<workflow>",
			'  <step number="1">',
			"    <name>Updated Issue Type</name>",
			">>>>>>> REPLACE",
		].join("\n")

		const result = await multiFileStrategy.applyDiff(realWorldProblematicXML, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toContain("Updated Issue Type")
		}
	}, 10000)

	it("should handle deeply nested XML with configurable timeout", async () => {
		// Test with a longer timeout for deeply nested content
		const strategy = new MultiFileSearchReplaceDiffStrategy(1.0, 40, 5000) // 5 second timeout

		const diffContent = [
			"<<<<<<< SEARCH",
			":start_line:1",
			"-------",
			"    <level0>",
			'      <data attr="value0">',
			"        <![CDATA[Complex content with special chars: < > & \" ']]>",
			"      </data>",
			"=======",
			"    <level0>",
			'      <data attr="updated0">',
			"        <![CDATA[Updated content with special chars: < > & \" ']]>",
			"      </data>",
			">>>>>>> REPLACE",
		].join("\n")

		const result = await strategy.applyDiff(deeplyNestedXML, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toContain("updated0")
		}
	}, 10000)

	it("should test configurable timeout parameter", async () => {
		// Test that custom timeout is respected
		const shortTimeoutStrategy = new MultiSearchReplaceDiffStrategy(1.0, 40, 50) // 50ms timeout
		const longTimeoutStrategy = new MultiSearchReplaceDiffStrategy(1.0, 40, 5000) // 5s timeout

		// This should timeout with short timeout
		const shortResult = await shortTimeoutStrategy.applyDiff(problematicXMLContent, invalidComplexDiffContent)
		expect(shortResult.success).toBe(false)
		if (!shortResult.success) {
			expect(shortResult.error).toContain("timed out")
		}

		// Same content might succeed with longer timeout (or at least not timeout as quickly)
		// We can't guarantee it succeeds due to the complex regex, but we test the mechanism
		const longResult = await longTimeoutStrategy.applyDiff(problematicXMLContent, validDiffContent)
		// This should succeed as validDiffContent is simple
		expect(longResult.success).toBe(true)
	}, 10000)
})
