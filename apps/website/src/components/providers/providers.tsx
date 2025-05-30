"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { PostHogProvider } from "./posthog-provider"

export const Providers = ({ children }: { children: React.ReactNode }) => {
	const queryClient = new QueryClient()

	return (
		<QueryClientProvider client={queryClient}>
			<PostHogProvider>
				<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
					{children}
				</ThemeProvider>
			</PostHogProvider>
		</QueryClientProvider>
	)
}
