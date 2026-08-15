// The published API guide, fetched from the api rather than restated here.
// A hand-written copy of this content lived in src/app/docs/page.tsx and
// drifted until it was missing an entire feature; this module exists so the
// console holds no guide content of its own.

import { isValidElement, type ReactNode } from "react";

export type DocDocument = {
  slug: string;
  title: string;
  markdown: string;
  updated_at: string;
};

// Filenames as the markdown links to them, mapped to the slug they render under.
export const FILE_TO_SLUG: Record<string, string> = {
  "public-api.md": "public-api",
  "public-api-privacy.md": "public-api-privacy",
  "webhooks.md": "webhooks",
};

// Server-side only. NOT NEXT_PUBLIC_API_URL: that is inlined at build time,
// and docker-compose defaults it to the console itself. And NOT loopback
// HTTP: production sets force_ssl, so http://127.0.0.1:3000 answers 301 to
// https://127.0.0.1:3000 where puma serves no TLS — the failure that broke
// every engine call on 2026-08-15.
function apiBase(): string {
  const configured = process.env.API_INTERNAL_URL;
  if (configured) return configured;

  // No silent loopback default in production. force_ssl answers
  // http://127.0.0.1:3000 with a 301 to TLS-less puma, so an unset variable
  // would fail exactly the way every engine call failed on 2026-08-15 — and
  // the page would show "temporarily unavailable" with nothing saying why.
  if (process.env.NODE_ENV === "production") {
    throw new Error("API_INTERNAL_URL must be set in production; loopback HTTP is refused by force_ssl");
  }
  return "http://127.0.0.1:3000";
}

export async function fetchDocs(): Promise<DocDocument[] | null> {
  try {
    // The explicit revalidate is load-bearing: without it Next 16 does not
    // cache at runtime, and this cache is what keeps /docs serving while the
    // api restarts.
    const res = await fetch(`${apiBase()}/api/public/v1/docs`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { documents: DocDocument[] };
    return body.documents ?? null;
  } catch {
    // An unreachable api must not throw here: the page renders a fallback.
    return null;
  }
}

export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^#\s+[^\n]*\n+/, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function headingId(docSlug: string, text: string): string {
  return `${docSlug}--${slugify(text)}`;
}

// react-markdown hands a heading's children as an array that mixes strings
// with React elements — a heading containing `code` yields an element, and
// String() on it gives "[object Object]". Twelve headings across the three
// documents contain inline code, and eight of them would collapse to the same
// id, which is the collision the prefixing exists to prevent.
export function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement(node)) return flattenText((node.props as { children?: ReactNode }).children);
  if (typeof node === "object" && node !== null && "props" in node) {
    return flattenText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

export function rewriteDocHref(href: string, slugByFile: Record<string, string>): string {
  const slug = slugByFile[href];
  return slug ? `#${slug}` : href;
}

export function tableOfContents(docs: DocDocument[]) {
  return docs.map((doc) => {
    const entries: { id: string; text: string }[] = [];
    let inFence = false;

    for (const line of doc.markdown.split("\n")) {
      if (line.startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const match = /^##\s+(.+?)\s*$/.exec(line);
      if (match) entries.push({ id: headingId(doc.slug, match[1]), text: match[1] });
    }

    return { docSlug: doc.slug, docTitle: doc.title, entries };
  });
}
