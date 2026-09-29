-- Conversion counts (DESIGN.md decision 176). One row per day, event, page and
-- locale, incremented in place: nothing about the visitor is stored — no IP,
-- no user agent, no cookie, no identifier.
CREATE TABLE events (
  day    TEXT    NOT NULL,  -- YYYY-MM-DD, UTC
  event  TEXT    NOT NULL,  -- mail | copy | services
  page   TEXT    NOT NULL,  -- the path the click happened on
  locale TEXT    NOT NULL,  -- derived from the path by the Worker
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, page, locale)
);
