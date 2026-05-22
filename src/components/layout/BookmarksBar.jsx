import React from "react";

const DEFAULT_BOOKMARK_ICON =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5h8A1.5 1.5 0 0 1 13.5 4v10L8 11.5 2.5 14V4A1.5 1.5 0 0 1 4 2.5Z" stroke="#8b949e" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `);

function BookmarkIcon({ url, title }) {
  const faviconUrl =
    url &&
    `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`;

  return (
    <img
      className="bookmarks-bar__icon"
      src={faviconUrl || DEFAULT_BOOKMARK_ICON}
      alt=""
      aria-hidden="true"
      title={title || url}
      onError={(event) => {
        const target = event.currentTarget;
        if (target.dataset.fallbackApplied === "1") return;
        target.dataset.fallbackApplied = "1";
        target.src = DEFAULT_BOOKMARK_ICON;
      }}
    />
  );
}

export default function BookmarksBar({
  bookmarks,
  onSelectBookmark,
  onRemoveBookmark,
}) {
  if (!Array.isArray(bookmarks) || bookmarks.length === 0) return null;

  return (
    <div className="bookmarks-bar" aria-label="Bookmarks">
      <div className="bookmarks-bar__list">
        {bookmarks.map((bookmark) => (
          <button
            key={bookmark.id}
            type="button"
            className="bookmarks-bar__item"
            onClick={() => onSelectBookmark?.(bookmark)}
            title={bookmark.title || bookmark.url}
          >
            <BookmarkIcon url={bookmark.url} title={bookmark.title || bookmark.url} />
            <span className="bookmarks-bar__title">
              {bookmark.title || bookmark.url}
            </span>
            <span
              className="bookmarks-bar__remove"
              role="button"
              aria-label={`Remove ${bookmark.title || bookmark.url}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveBookmark?.(bookmark);
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              ×
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}