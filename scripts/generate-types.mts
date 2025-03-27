import fs from "fs/promises"

import { zodToTs, createTypeAlias, printNode } from "zod-to-ts"
import { $ } from "execa"

import { typeDefinitions } from "../src/schemas"

async function main() {
	const types: string[] = [
		"// This file is automatically generated by running `npx tsx scripts/generate-types.mts`\n// Do not edit it directly.",
	]

	for (const { schema, identifier } of typeDefinitions) {
		types.push(printNode(createTypeAlias(zodToTs(schema, identifier).node, identifier)))
		types.push(`export type { ${identifier} }`)
	}

	await fs.writeFile("src/exports/types.ts", types.join("\n\n"))
	await $`npx prettier --write src/exports/types.ts`
}

main()
