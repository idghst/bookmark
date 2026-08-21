import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LONG_FOLDER = "Claude Anthropic Research Workspace";
const LONG_SECTION = "OpenAI API 실험 노트 모음";

function NameSelect({
  label,
  shortValue,
  longValue,
}: {
  label: string;
  shortValue: string;
  longValue: string;
}) {
  return (
    <Select defaultValue="short" open>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="short">{shortValue}</SelectItem>
        <SelectItem value="long">{longValue}</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("select option overflow", () => {
  it("keeps the full folder name readable in the open list", async () => {
    render(<NameSelect label="폴더" shortValue="기타" longValue={LONG_FOLDER} />);
    const option = await screen.findByRole("option", { name: LONG_FOLDER });
    expect(option).toHaveTextContent(LONG_FOLDER);
    expect(option.className).not.toMatch(/truncate/);
    expect(option.className).toMatch(/whitespace-normal/);
    expect(option.className).toMatch(/break-words/);
    const viewport = option.closest("[data-slot=select-content]")?.querySelector("[data-position]");
    expect(viewport?.className ?? "").toMatch(/min-w-\[var\(--radix-select-trigger-width\)\]/);
    expect(viewport?.className ?? "").not.toMatch(/(?:^|\s)w-\[var\(--radix-select-trigger-width\)\]/);
  });

  it("keeps the full section name readable in the open list", async () => {
    render(<NameSelect label="섹션" shortValue="섹션 없음" longValue={LONG_SECTION} />);
    const option = await screen.findByRole("option", { name: LONG_SECTION });
    expect(option).toHaveTextContent(LONG_SECTION);
    expect(option.className).not.toMatch(/truncate/);
    expect(option.className).toMatch(/whitespace-normal/);
  });
});
