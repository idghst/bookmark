import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";

describe("not found page", () => {
  it("returns users to the bookmark root", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "북마크로 돌아가기" })).toHaveAttribute("href", "/");
  });
});
