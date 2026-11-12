import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * A chat message's text, formatted like WhatsApp: *bold*, _italic_, ~strikethrough~, `inline code`,
 * ```monospace```, "> " quotes and "* " / "- " / "1. " lists. Links open, @mentions go to the
 * profile, and search matches are highlighted.
 */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]!?])/gi;
const MENTION_RE = /(^|\s)@([A-Za-z0-9_.]{2,30})/g;

const INLINE: { re: RegExp; wrap: (children: ReactNode, key: string) => ReactNode }[] = [
  { re: /(^|[\s(["'])\*(\S(?:[^*\n]*?\S)?)\*(?=$|[\s.,!?;:)\]"'])/, wrap: (c, k) => <strong key={k} className="font-bold">{c}</strong> },
  { re: /(^|[\s(["'])_(\S(?:[^_\n]*?\S)?)_(?=$|[\s.,!?;:)\]"'])/, wrap: (c, k) => <em key={k}>{c}</em> },
  { re: /(^|[\s(["'])~(\S(?:[^~\n]*?\S)?)~(?=$|[\s.,!?;:)\]"'])/, wrap: (c, k) => <s key={k}>{c}</s> },
  { re: /(^|[\s(["'])`([^`\n]+)`(?=$|[\s.,!?;:)\]"'])/, wrap: (c, k) => <code key={k} className="rounded bg-black/10 px-1 font-mono text-[0.92em]">{c}</code> },
];

function highlightText(text: string, highlight: string | undefined, key: string): ReactNode {
  if (!highlight) return text;
  const q = highlight.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  const lower = text.toLowerCase();
  for (let at = lower.indexOf(q); at >= 0; at = lower.indexOf(q, i)) {
    if (at > i) out.push(text.slice(i, at));
    out.push(<mark key={`${key}h${at}`} className="rounded-sm bg-amber-300 px-0.5 text-black">{text.slice(at, at + q.length)}</mark>);
    i = at + q.length;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

/** Plain text → links, @mentions, highlights. */
function plain(text: string, ctx: Ctx, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(URL_RE).forEach((part, i) => {
    if (i % 2) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      out.push(
        <a key={`${key}u${i}`} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="break-all underline decoration-current/50 underline-offset-2">
          {highlightText(part, ctx.highlight, `${key}u${i}`)}
        </a>,
      );
      return;
    }
    let last = 0;
    for (const m of part.matchAll(MENTION_RE)) {
      const start = (m.index ?? 0) + m[1].length;
      if (start > last) out.push(<Fragment key={`${key}t${i}-${last}`}>{highlightText(part.slice(last, start), ctx.highlight, `${key}t${i}-${last}`)}</Fragment>);
      const username = m[2];
      out.push(
        <Link key={`${key}m${i}-${start}`} to={`/profile/${username}`} onClick={(e) => e.stopPropagation()} className={ctx.mentionClass}>
          @{username}
        </Link>,
      );
      last = start + 1 + username.length;
    }
    if (last < part.length) out.push(<Fragment key={`${key}t${i}-${last}`}>{highlightText(part.slice(last), ctx.highlight, `${key}t${i}-${last}`)}</Fragment>);
  });
  return out;
}

/** Inline styles (can nest: *_bold italic_*). */
function inline(text: string, ctx: Ctx, key: string): ReactNode[] {
  let best: { index: number; m: RegExpMatchArray; wrap: (typeof INLINE)[number]["wrap"] } | null = null;
  for (const { re, wrap } of INLINE) {
    const m = text.match(re);
    if (m && m.index !== undefined && (!best || m.index < best.index)) best = { index: m.index, m, wrap };
  }
  if (!best) return plain(text, ctx, key);
  const { m, wrap } = best;
  const lead = m[1];
  const start = best.index + lead.length;
  const end = best.index + m[0].length;
  return [
    ...plain(text.slice(0, start), ctx, `${key}a`),
    wrap(inline(m[2], ctx, `${key}b`), `${key}w`),
    ...inline(text.slice(end), ctx, `${key}c`),
  ];
}

type Ctx = { highlight?: string; mentionClass: string };

export const ChatText = ({ text, highlight, mine }: { text: string; highlight?: string; mine?: boolean }) => {
  const ctx: Ctx = { highlight: highlight?.trim() || undefined, mentionClass: mine ? "font-semibold underline-offset-2 hover:underline" : "font-semibold text-amber-700 hover:underline" };
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((block, bi) => {
        if (bi % 2) return <code key={bi} className="my-0.5 block whitespace-pre-wrap rounded-md bg-black/10 px-2 py-1 font-mono text-[0.9em]">{block.replace(/^\n|\n$/g, "")}</code>;
        const lines = block.split("\n");
        return (
          <Fragment key={bi}>
            {lines.map((line, li) => {
              const k = `${bi}-${li}`;
              const br = li < lines.length - 1 ? <br /> : null;
              const quote = line.match(/^>\s?(.*)$/);
              if (quote) return <span key={k} className="my-0.5 block border-l-[3px] border-current/40 pl-2 opacity-90">{inline(quote[1], ctx, k)}</span>;
              const bullet = line.match(/^\s*[*-]\s+(.*)$/);
              if (bullet) return <span key={k} className="block pl-1"><span className="mr-1.5">•</span>{inline(bullet[1], ctx, k)}</span>;
              const num = line.match(/^\s*(\d{1,3})\.\s+(.*)$/);
              if (num) return <span key={k} className="block pl-1"><span className="mr-1.5 tabular-nums">{num[1]}.</span>{inline(num[2], ctx, k)}</span>;
              return <Fragment key={k}>{inline(line, ctx, k)}{br}</Fragment>;
            })}
          </Fragment>
        );
      })}
    </>
  );
};
