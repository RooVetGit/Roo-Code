import fs from "fs/promises"

import { zodToTs, createTypeAlias, printNode } from "zod-to-ts"
import { $ } from "execa"

import { typeDefinitions } from "../src/schemas"

async function main() {
	const types: string[] = [
		"// This file is automatically generated by running `npm run generate-types`\n// Do not edit it directly.",
	]

	for (const { schema, identifier } of typeDefinitions) {
		types.push(printNode(createTypeAlias(zodToTs(schema, identifier).node, identifier)))
		types.push(`export type { ${identifier} }`)
	}

	await fs.writeFile("src/exports/types.ts", types.join("\n\n"))

	await $`npx tsup src/exports/interface.ts --dts-only -d out`
	await fs.copyFile('out/interface.d.ts', 'src/exports/roo-code.d.ts')

	await $`npx prettier --write src/exports/types.ts src/exports/roo-code.d.ts`
}

main()
