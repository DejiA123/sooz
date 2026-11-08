import { Fragment, useMemo } from "react";
import { Link } from "react-router-dom";

const BOOKS =
  "Genesis|Gen|Exodus|Exod?|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Ruth|(?:1|2|I|II)\\s?Samuel|(?:1|2|I|II)\\s?Kings|(?:1|2|I|II)\\s?Chronicles|Ezra|Nehemiah|Neh|Esther|Job|Psalms?|Ps|Proverbs|Prov|Ecclesiastes|Eccl|Song of Solomon|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek|Daniel|Dan|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Zech|Malachi|Mal|Matthew|Matt|Mark|Luke|John|(?:1|2|3|I|II|III)\\s?John|Acts|Romans|Rom|(?:1|2|I|II)\\s?Corinthians|(?:1|2|I|II)\\s?Cor|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|(?:1|2|I|II)\\s?Thessalonians|(?:1|2|I|II)\\s?Timothy|(?:1|2|I|II)\\s?Tim|Titus|Philemon|Hebrews|Heb|James|(?:1|2|I|II)\\s?Peter|(?:1|2|I|II)\\s?Pet|Jude|Revelation|Rev";

// "John 3:16", "Psalm 23", "1 Cor 13:4-7", "#jesus", "@pastor_ade"
const TOKEN = new RegExp(`(\\b(?:${BOOKS})\\.?\\s\\d{1,3}(?::\\d{1,3}(?:[-–]\\d{1,3})?)?\\b)|(#[\\p{L}\\p{N}_]+)|(@[\\w.]{2,30})`, "gu");

type Part = { type: "text" | "verse" | "tag" | "mention"; value: string };

export function parseCaption(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ type: "text", value: text.slice(last, i) });
    parts.push({ type: m[1] ? "verse" : m[2] ? "tag" : "mention", value: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

export const bibleSearchUrl = (ref: string) => `https://www.bible.com/search/bible?q=${encodeURIComponent(ref)}`;

/** Caption text with tappable Bible references, hashtags and @mentions. */
export const RichCaption = ({ text, mentionsAreSooz = true }: { text: string; mentionsAreSooz?: boolean }) => {
  const parts = useMemo(() => parseCaption(text), [text]);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "verse") {
          return (
            <a
              key={i}
              href={bibleSearchUrl(p.value)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mx-0.5 inline-flex items-baseline rounded-md bg-primary/20 px-1.5 py-px font-semibold text-amber-200 underline-offset-2 hover:underline"
            >
              {p.value}
            </a>
          );
        }
        if (p.type === "tag") return <span key={i} className="font-bold text-white">{p.value}</span>;
        if (p.type === "mention" && mentionsAreSooz) {
          return (
            <Link key={i} to={`/profile/${p.value.slice(1)}`} onClick={(e) => e.stopPropagation()} className="font-bold text-white hover:underline">
              {p.value}
            </Link>
          );
        }
        return <Fragment key={i}>{p.value}</Fragment>;
      })}
    </>
  );
};
