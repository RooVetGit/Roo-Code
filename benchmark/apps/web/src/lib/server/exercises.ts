"use server"

import * as fs from "fs/promises"
import * as path from "path"
import { fileURLToPath } from "url"

import { ExerciseLanguage, exerciseLanguages } from "@benchmark/types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const listDirectories = async (relativePath: string) => {
	try {
		const targetPath = path.resolve(__dirname, relativePath)
		const entries = await fs.readdir(targetPath, { withFileTypes: true })
		return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name)
	} catch (error) {
		console.error(`Error listing directories at ${relativePath}:`, error)
		return []
	}
}

// __dirname = <repo>/benchmark/apps/web/src/lib/server
const EXERCISES_BASE_PATH = path.resolve(__dirname, "../../../../../../../exercises")

export const getExercises = async () => {
	const result = await Promise.all(
		exerciseLanguages.map(async (language) => {
			const languagePath = path.join(EXERCISES_BASE_PATH, language)
			const exercises = await listDirectories(languagePath)
			return exercises.map((exercise) => `${language}/${exercise}`)
		}),
	)

	return result.flat()
}

export const getExercisesForLanguage = async (language: ExerciseLanguage) =>
	listDirectories(path.join(EXERCISES_BASE_PATH, language))
