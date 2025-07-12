import { render } from "@testing-library/react";
import { Markdown } from "../../chat/Markdown";
import { vi } from "vitest";

vi.mock("../MarkdownBlock", () => ({
  __esModule: true,
  default: vi.fn(({ markdown }) => (
    <div data-testid="mock-markdown-block">{markdown}</div>
  )),
}));

vi.mock("@src/context/ExtensionStateContext", () => ({
  useExtensionState: () => ({
    theme: "dark",
  }),
}));

describe("Markdown Table Integration", () => {
  it("renders table in markdown", () => {
    const md = `Text before
| Header |
|--------|
| Cell   |
Text after`;
    const { container } = render(<Markdown markdown={md} />);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("th")?.textContent).toBe("Header");
    expect(container.querySelector("td")?.textContent).toBe("Cell");
    const markdownBlocks = container.querySelectorAll('[data-testid="mock-markdown-block"]');
    expect(markdownBlocks.length).toBe(2);
    expect(markdownBlocks[0]?.textContent).toContain("Text before");
    expect(markdownBlocks[1]?.textContent).toContain("Text after");
  });

  it("handles multiple tables", () => {
    const md = `| Table 1 |\n|---------|\n| Cell  |\n\n| Table 2 |\n|---------|\n| Cell  |`;
    const { container } = render(<Markdown markdown={md} />);
    expect(container.querySelectorAll("table").length).toBe(2);
    expect(container.querySelectorAll("th")[0]?.textContent).toBe("Table 1");
    expect(container.querySelectorAll("th")[1]?.textContent).toBe("Table 2");
  });

  it("handles markdown text interspersed with tables", () => {
    const md = `This is some **bold** text.

| Header A | Header B |
|----------|----------|
| Value A1 | Value B1 |

And here is some *italic* text after the table.

| Header C |
|----------|
| Value C1 |`;
    const { container } = render(<Markdown markdown={md} />);
    expect(container.querySelectorAll("table").length).toBe(2);
    const markdownBlocks = container.querySelectorAll('[data-testid="mock-markdown-block"]');
    expect(markdownBlocks.length).toBe(2);
    expect(markdownBlocks[0]?.textContent).toContain("This is some **bold** text.");
    expect(markdownBlocks[1]?.textContent).toContain("And here is some *italic* text after the table.");
  });

  it("handles tables at the beginning of the markdown", () => {
    const md = `| Start Header |
|--------------|
| Start Cell   |
Text after table.`;
    const { container } = render(<Markdown markdown={md} />);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("th")?.textContent).toBe("Start Header");
    const markdownBlocks = container.querySelectorAll('[data-testid="mock-markdown-block"]');
    expect(markdownBlocks.length).toBe(1);
    expect(markdownBlocks[0]?.textContent).toContain("Text after table.");
  });

  it("handles tables at the end of the markdown", () => {
    const md = `Text before table.
| End Header |
|------------|
| End Cell   |`;
    const { container } = render(<Markdown markdown={md} />);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("th")?.textContent).toBe("End Header");
    const markdownBlocks = container.querySelectorAll('[data-testid="mock-markdown-block"]');
    expect(markdownBlocks.length).toBe(1);
    expect(markdownBlocks[0]?.textContent).toContain("Text before table.");
  });

  it("handles markdown with no tables", () => {
    const md = `Just some plain **markdown** text.`;
    const { container } = render(<Markdown markdown={md} />);
    expect(container.querySelector("table")).not.toBeInTheDocument();
    const markdownBlocks = container.querySelectorAll('[data-testid="mock-markdown-block"]');
    expect(markdownBlocks.length).toBe(1);
    expect(markdownBlocks[0]?.textContent).toContain("Just some plain **markdown** text.");
  });

  it("handles empty markdown string", () => {
    const { container } = render(<Markdown markdown="" />);
    expect(container.innerHTML).toBe("");
  });

  it("handles markdown with only a table", () => {
    const md = `| Only Table |
|------------|
| Cell       |`;
    const { container } = render(<Markdown markdown={md} />);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("th")?.textContent).toBe("Only Table");
  });

  it("handles bold markdown in table cells", () => {
    const md = `| Header |\n|--------|\n| Cell with **bold** text |`;
    const { container } = render(<Markdown markdown={md} />);
    const cellContent = container.querySelector("td");
    expect(cellContent?.innerHTML).toContain("<strong>bold</strong>");
  });

  it("handles italic markdown in table cells", () => {
    const md = `| Header |\n|--------|\n| Cell with _italic_ text |`;
    const { container } = render(<Markdown markdown={md} />);
    const cellContent = container.querySelector("td");
    expect(cellContent?.innerHTML).toContain("<em>italic</em>");
  });

  it("handles code markdown in table cells", () => {
    const md = `| Header |\n|--------|\n| Cell with \`code\` snippet |`;
    const { container } = render(<Markdown markdown={md} />);
    const cellContent = container.querySelector("td");
    expect(cellContent?.querySelector("code")?.textContent).toContain("code");
  });

  it("handles link markdown in table cells", () => {
    const md = `| Header |\n|--------|\n| Cell with a [link](http://example.com) |`;
    const { container } = render(<Markdown markdown={md} />);
    const cellContent = container.querySelector("td");
    expect(cellContent?.innerHTML).toContain("<a href=\"http://example.com\"");
    expect(cellContent?.innerHTML).toContain("link</a>");
  });
});