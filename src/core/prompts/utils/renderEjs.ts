import * as ejs from "ejs"

export function renderEjs(template: string, vars: Record<string, unknown>): string {
	return ejs.render(template, vars)
}
