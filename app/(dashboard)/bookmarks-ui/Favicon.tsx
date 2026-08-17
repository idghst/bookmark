import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { safeUrl } from "@/app/lib/bookmarks/url";
import { cn } from "@/lib/utils";

export function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

  if (!safeUrl(url) || failed) {
    return <Globe className="h-4 w-4 text-[var(--text-muted)]" />;
  }

  return (
    <span className="relative flex h-[18px] w-[18px] items-center justify-center">
      {!loaded ? <Globe className="h-4 w-4 text-[var(--text-muted)]" /> : null}
      <img
        src={`/api/favicon?url=${encodeURIComponent(url)}&size=32`}
        alt=""
        width={18}
        height={18}
        draggable={false}
        className={cn("absolute inset-0 h-[18px] w-[18px] rounded-sm", loaded ? "opacity-100" : "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
