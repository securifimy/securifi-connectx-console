import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import {
  fetchDocs,
  flattenText,
  stripLeadingH1,
  headingId,
  rewriteDocHref,
  tableOfContents,
  FILE_TO_SLUG,
  type DocDocument,
} from "./docs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function doc(slug: string, title: string, markdown: string): DocDocument {
  return { slug, title, markdown, updated_at: "2026-08-15T00:00:00Z" };
}

describe("stripLeadingH1", () => {
  // Each document opens with its own H1, and two of the three disagree with
  // the title the endpoint supplies. Rendering both gives a doubled and
  // contradictory heading.
  it("removes the opening H1 and nothing else", () => {
    expect(stripLeadingH1("# Public API\n\nBody text\n\n# Not the first\n"))
      .toBe("Body text\n\n# Not the first\n");
  });

  it("leaves a document that does not start with an H1 alone", () => {
    expect(stripLeadingH1("Body first\n\n# Later\n")).toBe("Body first\n\n# Later\n");
  });

  it("does not mistake an H2 for an H1", () => {
    expect(stripLeadingH1("## Section\n\nBody\n")).toBe("## Section\n\nBody\n");
  });
});

describe("headingId", () => {
  // `### From the console` exists in BOTH public-api.md and webhooks.md.
  // Concatenated without a prefix they produce duplicate DOM ids and the
  // browser jumps to whichever came first.
  it("prefixes with the document slug so identical headings do not collide", () => {
    expect(headingId("public-api", "From the console")).toBe("public-api--from-the-console");
    expect(headingId("webhooks", "From the console")).toBe("webhooks--from-the-console");
  });

  it("slugifies punctuation and case", () => {
    expect(headingId("webhooks", "5. `store: false` — send it, keep nothing"))
      .toBe("webhooks--5-store-false-send-it-keep-nothing");
  });

  // The TOC slugifies raw markdown; the page slugifies flattenText of parsed
  // children. A heading containing a link diverges between the two unless
  // slugify strips the link syntax down to its text first: raw
  // `## See [privacy](public-api-privacy.md)` vs. a rendered `a` whose
  // children are just "privacy".
  it("agrees with the rendered id for a heading containing a link", () => {
    const fromMarkdown = headingId("public-api", "See [privacy](public-api-privacy.md)");
    const fromChildren = headingId(
      "public-api",
      flattenText(["See ", createElement("a", { href: "public-api-privacy.md" }, "privacy")]),
    );

    expect(fromChildren).toBe(fromMarkdown);
  });
});

describe("rewriteDocHref", () => {
  // Seven links across the three files use this form. Rendered on one page
  // they resolve to /public-api-privacy.md, a 404 apiece.
  it("turns a sibling document link into an in-page anchor", () => {
    expect(rewriteDocHref("public-api-privacy.md", FILE_TO_SLUG)).toBe("#public-api-privacy");
    expect(rewriteDocHref("webhooks.md", FILE_TO_SLUG)).toBe("#webhooks");
  });

  it("leaves external and anchor links untouched", () => {
    expect(rewriteDocHref("https://example.com/x.md", FILE_TO_SLUG)).toBe("https://example.com/x.md");
    expect(rewriteDocHref("#already-an-anchor", FILE_TO_SLUG)).toBe("#already-an-anchor");
  });

  it("leaves a markdown file it does not publish untouched", () => {
    expect(rewriteDocHref("engine-rs/docs/PRIVACY.md", FILE_TO_SLUG)).toBe("engine-rs/docs/PRIVACY.md");
  });
});

describe("flattenText", () => {
  // The heading override receives React elements, not strings. String() on one
  // gives "[object Object]" — and eight `### `4xx …`` headings would then all
  // share id "public-api--object-object". Fixtures are real elements built
  // with createElement, the same shape react-markdown actually passes —
  // plain `{ props: { children } }` objects exercised a dead duck-typed
  // branch that production code never hits.
  it("reads through an element child instead of stringifying it", () => {
    const children = ["5. ", createElement("code", null, "store: false"), " — keep nothing"];

    expect(flattenText(children)).toBe("5. store: false — keep nothing");
  });

  it("recurses through nested elements", () => {
    const nested = createElement("strong", null, "a", createElement("code", null, "b"));

    expect(flattenText(nested)).toBe("ab");
  });

  it("survives null, booleans and numbers", () => {
    expect(flattenText([null, true, 4, "x"])).toBe("4x");
  });

  // The whole point: the id from rendered children must equal the id the
  // table of contents computed from the raw markdown.
  it("agrees with the id built from raw markdown text", () => {
    const fromMarkdown = headingId("public-api", "5. `store: false` — keep nothing");
    const fromChildren = headingId(
      "public-api",
      flattenText(["5. ", createElement("code", null, "store: false"), " — keep nothing"]),
    );

    expect(fromChildren).toBe(fromMarkdown);
  });
});

describe("fetchDocs", () => {
  // The only function here with error handling, and the page's fallback
  // depends on it returning null rather than throwing.
  it("returns null when the api cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(fetchDocs()).resolves.toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(fetchDocs()).resolves.toBeNull();
  });

  it("returns the documents on success", async () => {
    const documents = [doc("webhooks", "Webhooks", "# Webhooks\n")];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents }) }));

    await expect(fetchDocs()).resolves.toEqual(documents);
  });

  // A failure that is only ever caught and discarded is indistinguishable
  // from one that never happened. Both failure paths must log.
  it("logs the response status on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await fetchDocs();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("503"));
  });

  // apiBase() throws a deliberate, specific error when API_INTERNAL_URL is
  // unset in production — but that throw happens inside fetchDocs's try, so
  // an unlogged catch would swallow the one message that explains why a
  // production box serves "temporarily unavailable" forever. This test is
  // the point of the finding: without it, the silence comes back unnoticed.
  it("logs the production guard's message when API_INTERNAL_URL is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(fetchDocs()).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: expect.stringContaining("API_INTERNAL_URL") }),
    );
  });
});

describe("tableOfContents", () => {
  it("lists h2 headings per document with ids matching headingId", () => {
    const docs = [
      doc("public-api", "WhatsApp public API", "# Public API\n\n## Base URLs\n\ntext\n\n## Send a message\n"),
      doc("webhooks", "Webhooks", "# Webhooks\n\n## Delivery model\n"),
    ];

    expect(tableOfContents(docs)).toEqual([
      {
        docSlug: "public-api",
        docTitle: "WhatsApp public API",
        entries: [
          { id: "public-api--base-urls", text: "Base URLs" },
          { id: "public-api--send-a-message", text: "Send a message" },
        ],
      },
      { docSlug: "webhooks", docTitle: "Webhooks", entries: [{ id: "webhooks--delivery-model", text: "Delivery model" }] },
    ]);
  });

  // A fenced block can contain a line starting with ##; it is code, not a heading.
  it("ignores headings inside fenced code blocks", () => {
    const docs = [doc("webhooks", "Webhooks", "## Real\n\n```bash\n## not a heading\n```\n")];

    expect(tableOfContents(docs)[0].entries).toEqual([{ id: "webhooks--real", text: "Real" }]);
  });
});
