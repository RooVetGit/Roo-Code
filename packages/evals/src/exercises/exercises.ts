import * as path from "path"
import * as fs from "fs"

import { filesystem } from "gluegun"

import { exercisesPath } from "./paths.js"

export const exerciseLanguages = ["go", "java", "javascript", "python", "rust"] as const

export type ExerciseLanguage = (typeof exerciseLanguages)[number]

export const isExerciseLanguage = (value: string): value is ExerciseLanguage =>
	exerciseLanguages.includes(value as ExerciseLanguage)

let exercisesByLanguage: Record<ExerciseLanguage, string[]> | null = null

export const getExercises = () => {
	if (exercisesByLanguage !== null) {
		return exercisesByLanguage
	}

	const getLanguageExercises = (language: ExerciseLanguage) =>
		fs.existsSync(path.resolve(exercisesPath, language))
			? filesystem
					.subdirectories(path.resolve(exercisesPath, language))
					.map((exercise) => path.basename(exercise))
					.filter((exercise) => !exercise.startsWith("."))
			: []

	exercisesByLanguage = exerciseLanguages.reduce(
		(collect, language) => ({ ...collect, [language]: getLanguageExercises(language) }),
		{} as Record<ExerciseLanguage, string[]>,
	)

	return exercisesByLanguage
}
