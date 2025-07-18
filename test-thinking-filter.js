// Simple test script to verify thinking tag filtering logic
const filterThinkingTags = (content) => {
	if (!content) return content

	// This is the exact logic from presentAssistantMessage.ts
	// Remove all instances of <thinking>...</thinking> blocks completely
	// while preserving content outside of thinking tags.
	// Also handles extra whitespace to prevent double newlines.
	content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
	
	// Handle partial thinking tags at the end of streaming content
	// Remove incomplete thinking tags that might appear during streaming
	content = content.replace(/<thinking>[\s\S]*$/g, "")
	
	// Clean up any remaining partial closing tags
	content = content.replace(/\s*<\/thinking>\s*$/g, "")
	
	// Clean up extra newlines that result from removing thinking blocks
	content = content.replace(/\n\n\n+/g, "\n\n")

	return content
}

// Test cases
console.log("Testing thinking tag filtering logic...\n")

// Test 1: Complete thinking tags
const test1 = `I'll analyze this step by step.

<thinking>
This is internal reasoning that should not be shown to the user.
Let me think about the best approach here.
</thinking>

Here's my analysis of the implementation plan:

1. First, I need to understand the requirements
2. Then I'll create a solution

<thinking>
Another internal thought process.
This should also be hidden.
</thinking>

The final recommendation is to proceed with the implementation.`

const expected1 = `I'll analyze this step by step.

Here's my analysis of the implementation plan:

1. First, I need to understand the requirements
2. Then I'll create a solution

The final recommendation is to proceed with the implementation.`

const result1 = filterThinkingTags(test1)
console.log("Test 1 - Complete thinking tags:")
console.log("PASS:", result1 === expected1)
if (result1 !== expected1) {
	console.log("Expected:", JSON.stringify(expected1))
	console.log("Got:", JSON.stringify(result1))
}
console.log()

// Test 2: Partial thinking tag
const test2 = `Here's my response.

<thinking>
This is a partial thinking tag that hasn't been closed yet because streaming is still in progress`

const expected2 = `Here's my response.

`

const result2 = filterThinkingTags(test2)
console.log("Test 2 - Partial thinking tag:")
console.log("PASS:", result2 === expected2)
if (result2 !== expected2) {
	console.log("Expected:", JSON.stringify(expected2))
	console.log("Got:", JSON.stringify(result2))
}
console.log()

// Test 3: Nested XML content
const test3 = `I'll help you with that.

<thinking>
Let me think about this:
<analysis>
  <step>1. Understand the problem</step>
  <step>2. Design solution</step>
</analysis>
This analysis should be hidden.
</thinking>

Here's the solution I recommend.`

const expected3 = `I'll help you with that.

Here's the solution I recommend.`

const result3 = filterThinkingTags(test3)
console.log("Test 3 - Nested XML content:")
console.log("PASS:", result3 === expected3)
if (result3 !== expected3) {
	console.log("Expected:", JSON.stringify(expected3))
	console.log("Got:", JSON.stringify(result3))
}
console.log()

// Test 4: No thinking tags
const test4 = `This is a normal response without any thinking tags.

It should be displayed exactly as written.`

const result4 = filterThinkingTags(test4)
console.log("Test 4 - No thinking tags:")
console.log("PASS:", result4 === test4)
if (result4 !== test4) {
	console.log("Expected:", JSON.stringify(test4))
	console.log("Got:", JSON.stringify(result4))
}
console.log()

// Test 5: Only thinking tags
const test5 = `<thinking>
This entire message is just internal reasoning.
Nothing should be displayed to the user.
</thinking>`

const expected5 = ``

const result5 = filterThinkingTags(test5)
console.log("Test 5 - Only thinking tags:")
console.log("PASS:", result5 === expected5)
if (result5 !== expected5) {
	console.log("Expected:", JSON.stringify(expected5))
	console.log("Got:", JSON.stringify(result5))
}
console.log()

console.log("All tests completed!")