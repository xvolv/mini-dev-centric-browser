import React, { useEffect, useState } from "react";

export default function BookmarkPanel({ onBookmarkSelect, currentTab }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      setError(null);
      const bookmarkData = await window.api?.getBookmarks?.();
      setBookmarks(Array.isArray(bookmarkData) ? bookmarkData : []);
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
      setError("Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBookmark = async (url, title) => {
    try {
      setIsAdding(true);
      setError(null);
      await window.api?.addBookmark?.(url, title);
      await loadBookmarks();
      return true;
    } catch (err) {
      console.error("Failed to add bookmark:", err);
      setError("Failed to add bookmark");
      return false;
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveBookmark = async (id) => {
    try {
      await window.api?.removeBookmark?.(id);
      await loadBookmarks();
      return true;
    } catch (err) {
      console.error("Failed to remove bookmark:", err);
      setError("Failed to remove bookmark");
      return false;
    }
  };

  const handleSelectBookmark = (bookmark) => {
    onBookmarkSelect?.(bookmark.url);
  };

  const handleAddCurrentTab = async () => {
    if (!currentTab || !currentTab.url) return;
    
    try {
      setIsAdding(true);
      setError(null);
      await window.api?.addBookmark?.(currentTab.url, currentTab.title);
      await loadBookmarks();
    } catch (err) {
      console.error("Failed to add current tab to bookmarks:", err);
      setError("Failed to add bookmark");
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="tool-panel">
        <div className="tool-panel__empty" style={{ padding: "40px 24px" }}>
          <div className="tool-panel__empty-title">Loading bookmarks...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tool-panel">
        <div className="tool-panel__empty" style={{ padding: "40px 24px" }}>
          <div className="tool-panel__empty-title">Error loading bookmarks</div>
          <div className="tool-panel__empty-desc">{error}</div>
        </div>
      </div>
    );
  }

  if (bookmarks.length === 0 && !isAdding) {
    return (
      <div className="tool-panel">
        <div className="tool-panel__empty" style={{ padding: "40px 24px" }}>
          <div className="tool-panel__empty-title">No bookmarks</div>
          <div className="tool-panel__empty-desc">
            Bookmarked pages will appear here
          </div>
          {currentTab && currentTab.url && (
            <button
              className="bookmark-panel__add-current"
              onClick={handleAddCurrentTab}
              disabled={isAdding}
            >
              {isAdding ? "Adding..." : "Bookmark this page"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tool-panel">
      <div className="bookmark-panel__header">
        <h2 className="bookmark-panel__title">Bookmarks</h2>
        <div className="bookmark-panel__actions">
          {currentTab && currentTab.url && (
            <button
              className="bookmark-panel__add-current"
              onClick={handleAddCurrentTab}
              disabled={isAdding}
              title="Bookmark current page"
            >
              {isAdding ? "Adding..." : "+"}
            </button>
          )}
        </div>
      </div>
      <div className="bookmark-panel__list">
        {bookmarks.map((bookmark) => (
          <div
            key={bookmark.id}
            className={`bookmark-panel__item ${
              onBookmarkSelect ? "bookmark-panel__item--clickable" : ""
            }`}
            onClick={() => handleSelectBookmark(bookmark)}
          >
            <div className="bookmark-panel__item-content">
              <div className="bookmark-panel__item-title">
                {bookmark.title || bookmark.url}
              </div>
              <div className="bookmark-panel__item-url">
                {bookmark.url}
              </div>
            </div>
            <button
              className="bookmark-panel__remove-btn"
              title="Remove bookmark"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveBookmark(bookmark.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}