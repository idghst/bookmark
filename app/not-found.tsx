import Link from "next/link";
import { BookmarkX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="justify-items-center gap-3">
          <BookmarkX className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">404</p>
          <CardTitle><h1>페이지를 찾을 수 없습니다</h1></CardTitle>
          <CardDescription>요청한 페이지가 없거나 이동되었습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link href="/">북마크로 돌아가기</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
