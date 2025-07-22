"use client"

import { useTheme } from "next-themes"
import { Footer } from "@/components/chromes"
import { Button } from "@/components/ui/button"

export default function TestFooterPage() {
	const { theme, setTheme } = useTheme()

	return (
		<div className="min-h-screen flex flex-col">
			<div className="flex-1 p-8">
				<h1 className="text-2xl font-bold mb-4">Footer Test Page</h1>
				<p className="mb-4">Use the button below to toggle between light and dark themes:</p>
				<Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} variant="outline">
					Toggle Theme (Current: {theme})
				</Button>
				<p className="mt-8 text-sm text-muted-foreground">
					Scroll down to see the footer with the &quot;Made with Roo Code&quot; logo.
				</p>
			</div>
			<Footer />
		</div>
	)
}
