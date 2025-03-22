/**
 * languages
 */

export const languages = ["cpp", "go", "java", "javascript", "python", "rust"] as const

export type Language = (typeof languages)[number]
