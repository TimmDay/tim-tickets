// Split (with a capturing group) needs the `g` flag to find every match; testing each
// resulting part uses its own non-global regex below, since `.test()` on a global regex is
// stateful across calls (advances lastIndex) and would silently skip alternating matches.
const URL_SPLIT_PATTERN = /(https?:\/\/[^\s]+)/g;
const URL_MATCH_PATTERN = /^https?:\/\//;

/** Renders text with any http(s) URLs turned into clickable links — used wherever free-text
 * (comments, descriptions) might contain a pasted link, e.g. a PR URL. */
export function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_SPLIT_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        URL_MATCH_PATTERN.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
