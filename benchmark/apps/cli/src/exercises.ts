import * as path from "path"
import * as fs from "fs"

import { filesystem } from "gluegun"

import { type Language, languages } from "@benchmark/types"

import { exercisesPath } from "./paths.js"

let exercisesByLanguage: Record<Language, string[]> | null = null

export const getExercises = () => {
	if (exercisesByLanguage !== null) {
		return exercisesByLanguage
	}

	const getLanguageExercises = (language: Language) =>
		fs.existsSync(path.resolve(exercisesPath, language))
			? filesystem
					.subdirectories(path.resolve(exercisesPath, language))
					.map((exercise) => path.basename(exercise))
					.filter((exercise) => !exercise.startsWith("."))
			: []

	exercisesByLanguage = languages.reduce(
		(collect, language) => ({ ...collect, [language]: getLanguageExercises(language) }),
		{} as Record<Language, string[]>,
	)

	return exercisesByLanguage
}
