import * as path from "path"
import { fileURLToPath } from "url"

export const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const extensionDevelopmentPath = path.resolve(__dirname, "..", "..", "..", "..")
export const extensionTestsPath = path.resolve(extensionDevelopmentPath, "benchmark/packages/runner/dist")
export const exercisesPath = path.resolve(extensionDevelopmentPath, "..", "exercises")
