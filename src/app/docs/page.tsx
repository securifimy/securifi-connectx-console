import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  fetchDocs,
  flattenText,
  headingId,
  rewriteDocHref,
  stripLeadingH1,
  tableOfContents,
  FILE_TO_SLUG,
  type DocDocument,
} from "@/lib/docs";

// Dynamic on purpose. A prerendered page would run this fetch during
// `next build` and fail the build whenever the api is restarting — and a
// prerendered page also caches whatever renders, so a caught fetch error
// would write the fallback into the page cache and evict the good copy.
// Dynamic, the failed revalidation serves the stale data-cache entry instead.
export const dynamic = "force-dynamic";

function headingProps(docSlug: string, children: ReactNode) {
  // flattenText, not String(): react-markdown passes React elements for
  // inline code, and String() on one yields "[object Object]".
  return { id: headingId(docSlug, flattenText(children)) };
}

function Document({ doc }: { doc: DocDocument }) {
  return (
    <section id={doc.slug} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-white">{doc.title}</h2>
      <div className="mt-5 space-y-4 text-sm text-slate-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => (
              <h3 {...headingProps(doc.slug, children)} className="mt-6 text-base font-semibold text-white">
                {children}
              </h3>
            ),
            h3: ({ children }) => (
              <h4 {...headingProps(doc.slug, children)} className="mt-4 text-sm font-semibold text-slate-100">
                {children}
              </h4>
            ),
            a: ({ href, children }) => (
              <a href={rewriteDocHref(href ?? "", FILE_TO_SLUG)} className="text-blue-400 underline">
                {children}
              </a>
            ),
            code: ({ children }) => (
              <code className="font-mono text-slate-100">{children}</code>
            ),
            pre: ({ children }) => (
              <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                {children}
              </pre>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-slate-800 px-3 py-2 text-left font-semibold text-white">{children}</th>
            ),
            td: ({ children }) => (
              <td className="border border-slate-800 px-3 py-2 align-top">{children}</td>
            ),
            ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          }}
        >
          {stripLeadingH1(doc.markdown)}
        </ReactMarkdown>
      </div>
    </section>
  );
}

function Unavailable() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-white">The guide is temporarily unavailable</h2>
      <p className="mt-3 text-sm text-slate-400">
        This page renders documentation served by the API, which is not responding right now. It is
        worth trying again shortly. The same content lives in the repository at{" "}
        <code className="font-mono text-slate-300">api/docs/public/</code>.
      </p>
    </section>
  );
}

export default async function DocsPage() {
  const docs = await fetchDocs();

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Docs</p>
          <h1 className="text-3xl font-semibold text-white">API guide</h1>
        </div>

        {docs === null ? (
          <Unavailable />
        ) : (
          <div className="lg:flex lg:gap-8">
            <nav className="mb-6 lg:sticky lg:top-12 lg:mb-0 lg:h-fit lg:w-56 lg:shrink-0">
              {tableOfContents(docs).map((section) => (
                <div key={section.docSlug} className="mb-4">
                  <a href={`#${section.docSlug}`} className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {section.docTitle}
                  </a>
                  <ul className="mt-2 space-y-1">
                    {section.entries.map((entry) => (
                      <li key={entry.id}>
                        <a href={`#${entry.id}`} className="text-xs text-slate-400 hover:text-slate-200">
                          {entry.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="min-w-0 flex-1 space-y-6">
              {docs.map((doc) => (
                <Document key={doc.slug} doc={doc} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
