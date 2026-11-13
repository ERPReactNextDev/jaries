"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={mounted ? (isDark ? "Switch to day mode" : "Switch to night mode") : "Toggle theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`h-8 w-8 shrink-0 rounded-full border border-border/80 bg-background/85 shadow-sm backdrop-blur-sm transition-all hover:bg-accent ${className ?? ""}`}
    >
      {mounted && isDark ? (
        <SunMedium className="h-4 w-4 text-amber-500" />
      ) : (
        <MoonStar className="h-4 w-4 text-slate-700 dark:text-slate-200" />
      )}
    </Button>
  );
}
