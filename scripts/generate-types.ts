import fs from "fs/promises"

import { zodToTs, createTypeAlias, printNode } from "zod-to-ts"

import { typeDefinitions } from "../src/schemas"

async function main() {
	const types: string[] = [
		"// This file is automatically generated by running `npx tsx scripts/generated-types.ts`\n// Do not edit it directly.",
	]

	for (const { schema, identifier } of typeDefinitions) {
		types.push(printNode(createTypeAlias(zodToTs(schema, identifier).node, identifier)))
	}

	await fs.writeFile("src/exports/types.d.ts", types.join("\n\n"))
}

main()
