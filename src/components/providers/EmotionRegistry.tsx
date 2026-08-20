"use client";

import { useServerInsertedHTML } from "next/navigation";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useState, type ReactNode } from "react";

/**
 * Collects all Emotion styles during SSR and injects them into <head>
 * via useServerInsertedHTML, preventing inline <style> tags from
 * appearing in <body> and causing React hydration mismatches.
 */
export function EmotionRegistry({ children }: { children: ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "css" });
    cache.compat = true;

    const inserted: string[] = [];
    const origInsert = cache.insert.bind(cache);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cache as any).insert = (...args: Parameters<typeof origInsert>) => {
      const serialized = args[1] as { name: string };
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return origInsert(...args);
    };

    const flush = () => {
      const prev = [...inserted];
      inserted.length = 0;
      return prev;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = "";
    for (const name of names) {
      const rule = cache.inserted[name];
      if (typeof rule === "string") styles += rule;
    }
    if (!styles) return null;
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
