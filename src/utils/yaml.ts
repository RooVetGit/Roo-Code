import fs from "fs/promises"
import yaml from "js-yaml"
import { fileExistsAtPath } from "./fs"

/**
 * Read a YAML file and parse its contents
 * @param filePath Path to the YAML file
 * @param defaultValue Default value to return if the file doesn't exist or can't be parsed
 * @returns Parsed YAML content or the default value
 */
export async function readYamlFile<T>(filePath: string, defaultValue: T): Promise<T> {
	try {
		if (await fileExistsAtPath(filePath)) {
			const content = await fs.readFile(filePath, "utf-8")
			return yaml.load(content) as T
		}
	} catch (error) {
		console.error(`Error reading YAML file ${filePath}:`, error)
	}
	return defaultValue
}

/**
 * Write data to a YAML file
 * @param filePath Path to the YAML file
 * @param data Data to write
 */
export async function writeYamlFile<T>(filePath: string, data: T): Promise<void> {
	try {
		const content = yaml.dump(data, {
			lineWidth: -1, // Don't wrap lines
			noRefs: true, // Don't use references
			indent: 2, // 2-space indentation
		})
		await fs.writeFile(filePath, content, "utf-8")
	} catch (error) {
		console.error(`Error writing YAML file ${filePath}:`, error)
		throw error
	}
}
