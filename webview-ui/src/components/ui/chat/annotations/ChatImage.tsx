import { type ImageData } from "../types"

export function ChatImage({ data }: { data: ImageData }) {
	return (
		<div className="max-w-[200px] rounded-md shadow-md">
			<img src={data.url} alt="chat_image" className="h-auto w-full" />
		</div>
	)
}
