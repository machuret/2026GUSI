-- Extended widget styling options
ALTER TABLE "ChatBot"
  ADD COLUMN IF NOT EXISTS "widgetPosition"    TEXT NOT NULL DEFAULT 'bottom-right',  -- 'bottom-right' | 'bottom-left'
  ADD COLUMN IF NOT EXISTS "widgetBorderRadius" INTEGER NOT NULL DEFAULT 16,           -- px, 0-24
  ADD COLUMN IF NOT EXISTS "widgetFontSize"    INTEGER NOT NULL DEFAULT 14,            -- px, 12-18
  ADD COLUMN IF NOT EXISTS "headerTextColor"   TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS "botBubbleColor"    TEXT NOT NULL DEFAULT '#f3f4f6',
  ADD COLUMN IF NOT EXISTS "botTextColor"      TEXT NOT NULL DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS "userBubbleColor"   TEXT NOT NULL DEFAULT '',               -- empty = use widgetColor
  ADD COLUMN IF NOT EXISTS "userTextColor"     TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS "showBranding"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "placeholderText"   TEXT NOT NULL DEFAULT 'Type a message…',
  ADD COLUMN IF NOT EXISTS "windowHeight"      INTEGER NOT NULL DEFAULT 520,           -- px, 400-700
  ADD COLUMN IF NOT EXISTS "windowWidth"       INTEGER NOT NULL DEFAULT 360;           -- px, 300-480
