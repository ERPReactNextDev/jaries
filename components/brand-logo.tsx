"use client";

import Image from "next/image";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "small";
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant = "full",
  alt = "JarIS CMS Logo",
  width,
  height,
  className,
  priority = false,
}: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const src = variant === "small" ? "/logo-small.png" : "/logo-full.png";
  const resolvedWidth = width ?? (variant === "small" ? 44 : 160);
  const resolvedHeight = height ?? (variant === "small" ? 44 : 40);

  return (
    <Image
      src={src}
      alt={alt}
      width={resolvedWidth}
      height={resolvedHeight}
      priority={priority}
      className={cn("object-contain transition-[filter] duration-200", className)}
      style={
        isDark
          ? { filter: "brightness(0) saturate(0) invert(1)" }
          : undefined
      }
    />
  );
}
