"use client";
import { useState } from "react";

const SOURCES = [
  (isbn: string) => `https://proxy-na.hosted.exlibrisgroup.com/exl_rewrite/syndetics.com/index.php?client=primo&isbn=${isbn}/SC.JPG`,
  (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,
];

/** The book's cover, or nothing when no source has one. Decorative: the title beside it names the book. */
export default function Cover({ isbns, className }: { isbns: string[]; className?: string }) {
  const isbn = isbns[0]?.split(" ")[0];
  const [tried, setTried] = useState({ isbn, count: 0 });
  const count = tried.isbn === isbn ? tried.count : 0; // a new book starts over at Syndetics
  const next = () => setTried({ isbn, count: count + 1 });
  if (!isbn || count >= SOURCES.length) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote covers of unknown size; nothing for next/image to optimize
    <img
      src={SOURCES[count](isbn)}
      alt=""
      loading="lazy"
      className={className}
      onError={next}
      // Syndetics answers a missing cover with a square placeholder; real covers are taller than wide.
      onLoad={(e) => e.currentTarget.naturalWidth === e.currentTarget.naturalHeight && next()}
    />
  );
}
