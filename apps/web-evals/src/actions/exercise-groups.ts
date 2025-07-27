"use server"

import exerciseGroups from "@/lib/exercise-groups.json"

export interface ExerciseGroup {
	name: string
	exercises: string[]
}

export const getExerciseGroups = async (): Promise<ExerciseGroup[]> => {
	return exerciseGroups.groups
}
