import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardAccountMenu } from "@/app/(dashboard)/DashboardAccountMenu";

describe("bookmark navigation", () => {
  it("exposes only the bookmark route", () => {
    render(<DashboardAccountMenu />);
    fireEvent.click(screen.getByLabelText("사용자 메뉴 열기"));

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.filter((item) => item instanceof HTMLAnchorElement)).toHaveLength(1);
    expect(menuItems.filter((item) => item instanceof HTMLAnchorElement).map((item) => item.getAttribute("href"))).toEqual([
      "/bookmarks"
    ]);
    expect(screen.getByRole("menuitem", { name: "로그아웃" })).toBeDisabled();
    expect(screen.queryByText("알림")).not.toBeInTheDocument();
    expect(screen.queryByText("Vercel 배포")).not.toBeInTheDocument();
    expect(screen.queryByText("Supabase")).not.toBeInTheDocument();
    expect(screen.queryByText("도구")).not.toBeInTheDocument();
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
  });
});
