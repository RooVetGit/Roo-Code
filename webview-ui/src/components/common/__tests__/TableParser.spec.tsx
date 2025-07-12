import { render } from "@testing-library/react";
import { parseTable } from "../TableParser";
import { parseInlineMarkdown } from "../InlineParser";

describe("TableParser", () => {
  it("parses simple table", () => {
    const table = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;
    const { container } = render(parseTable(table, "test-table")!);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelectorAll("th").length).toBe(2);
    expect(container.querySelector("th")?.textContent).toBe("Header 1");
    expect(container.querySelectorAll("td").length).toBe(2);
    expect(container.querySelector("td")?.textContent).toBe("Cell 1");
  });

  it("handles invalid tables", () => {
    expect(parseTable("invalid content", "test")).toBeNull();
    expect(parseTable("| Header |\n", "test")).toBeNull();
    expect(parseTable("| Header |\n|---|", "test")).not.toBeNull();
  });

  it("handles HTML in cells", () => {
    const table = `| Header |
|--------|
| <b>Bold</b> |`;
    const { container } = render(parseTable(table, "html-table")!);
    expect(container.querySelector("b")).toBeInTheDocument();
    expect(container.querySelector("b")?.textContent).toBe("Bold");
  });

  it("handles markdown in cells", () => {
    const table = `| Header |
|--------|
| **Bold** and _italic_ |`;
    const { container } = render(parseTable(table, "markdown-table")!);
    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("em")).toBeInTheDocument();
    expect(container.querySelector("strong")?.textContent).toBe("Bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
  });

  it("handles empty cells", () => {
    const table = `| H1 | H2 |
|----|----|
| C1 |    |`;
    const { container } = render(parseTable(table, "empty-cell-table")!);
    expect(container.querySelectorAll("td")[1].textContent).toBe("");
  });

  it("handles tables with extra spaces", () => {
    const table = `|  Header 1  |  Header 2  |
|------------|------------|
|   Cell 1   |   Cell 2   |`;
    const { container } = render(parseTable(table, "spaced-table")!);
    expect(container.querySelector("th")?.textContent).toBe("Header 1");
    expect(container.querySelector("td")?.textContent).toBe("Cell 1");
  });

  it("handles tables with alignment markers", () => {
    const table = `| Left | Center | Right |
|:-----|:------:|------:|
| L    |   C    |     R |`;
    const { container } = render(parseTable(table, "alignment-table")!);
    expect(container.querySelectorAll("th").length).toBe(3);
    expect(container.querySelectorAll("td").length).toBe(3);
  });

  it("returns null for tables with too few lines", () => {
    expect(parseTable("| Header |", "short-table")).toBeNull();
    expect(parseTable("", "empty-table")).toBeNull();
  });

  it("handles multiple data rows", () => {
    const table = `| H1 | H2 |
|----|----|
| R1C1 | R1C2 |
| R2C1 | R2C2 |`;
    const { container } = render(parseTable(table, "multi-row-table")!);
    expect(container.querySelectorAll("tr").length).toBe(3); // 1 header + 2 data rows
    expect(container.querySelectorAll("td").length).toBe(4);
  });

  it("handles tables with no data rows", () => {
    const table = `| H1 | H2 |
|----|----|`;
    const { container } = render(parseTable(table, "no-data-table")!);
    expect(container.querySelectorAll("tr").length).toBe(1); // Only header row
    expect(container.querySelectorAll("td").length).toBe(0);
  });

  it("parses bold markdown", () => {
    const text = "Cell with **bold** text.";
    const result = parseInlineMarkdown(text, 0);
    const container = render(<div>{result}</div>).container;
    expect(container.innerHTML).toContain("<strong>bold</strong>");
  });

  it("parses italic markdown", () => {
    const text = "Cell with _italic_ text.";
    const result = parseInlineMarkdown(text, 0);
    const container = render(<div>{result}</div>).container;
    expect(container.innerHTML).toContain("<em>italic</em>");
  });

  it("parses code markdown", () => {
    const text = "Cell with `code` snippet.";
    const result = parseInlineMarkdown(text, 0);
    const container = render(<div>{result}</div>).container;
    expect(container.querySelector("code")?.textContent).toContain("code");
  });

  it("parses link markdown", () => {
    const text = "Cell with a [link](http://example.com).";
    const result = parseInlineMarkdown(text, 0);
    const container = render(<div>{result}</div>).container;
    expect(container.innerHTML).toContain("<a href=\"http://example.com\"");
    expect(container.innerHTML).toContain("link</a>");
  });
});