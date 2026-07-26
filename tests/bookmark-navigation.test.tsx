import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardAccountMenu } from "@/app/(dashboard)/DashboardAccountMenu";

describe("bookmark navigation", () => {
  it("exposes only the bookmark route", () => {
    render(<DashboardAccountMenu />);
    fireEvent.click(screen.getByLabelText("사용자 메뉴 열기"));

    expect(screen.getByRole("menuitem", { name: "북마크" })).toHaveAttribute(
      "href",
      "/bookmarks"
    );
    expect(screen.queryByText("Vercel 배포")).not.toBeInTheDocument();
    expect(screen.queryByText("Supabase")).not.toBeInTheDocument();
    expect(screen.queryByText("도구")).not.toBeInTheDocument();
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
  });
});
