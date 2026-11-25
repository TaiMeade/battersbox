#!/bin/sh
# Copies BattersBox's nightly backups to OneDrive with rclone, so a copy
# exists outside the house. Same approach as Mission Control's, the vault's
# and Search Metrics' scripts.
#
# The sync server writes nightly-YYYY-MM-DD.db to /mnt/media/Backups/battersbox
# at 03:15 every night. This uploads that folder to its own OneDrive folder.
# Scorebooks are not sensitive, so this uses the plain onedrive remote, not
# the vault's crypt remote (whose cleanup also matches nightly-*.db names).
#
# Run from cron after the nightly backup:
#   55 3 * * * sh $HOME/battersbox/scripts/offsite-backup.sh
#
# Settings, overridable from the environment:
SRC="${BB_OFFSITE_SRC:-/mnt/media/Backups/battersbox}"
DEST="${BB_OFFSITE_DEST:-onedrive:PersonalDevelopment/battersbox-backups}"
KEEP_DAYS="${BB_OFFSITE_KEEP_DAYS:-90}"
LOG="${BB_OFFSITE_LOG:-$HOME/.local/state/battersbox-offsite-backup.log}"
PATTERN="nightly-*.db"

mkdir -p "$(dirname "$LOG")"
{
  echo "=== $(date -Is)"
  if [ ! -d "$SRC" ]; then
    # Typically the media drive is not mounted. Nothing is uploaded and
    # nothing is deleted from DEST.
    echo "FAILED: $SRC does not exist; nothing copied"
  elif ! find "$SRC" -maxdepth 1 -name "$PATTERN" -mtime -2 | grep -q .; then
    # No backup from the last two days: the server has stopped taking them.
    # Upload whatever is there, but delete nothing, or 90 days from now the
    # off-site copy would be empty.
    rclone copy "$SRC" "$DEST" --include "/$PATTERN" --ignore-existing -v
    echo "STALE: no backup newer than 2 days in $SRC; nothing deleted from $DEST. Check the battersbox container."
  elif rclone copy "$SRC" "$DEST" --include "/$PATTERN" --ignore-existing -v &&
       rclone delete "$DEST" --include "/$PATTERN" --min-age "${KEEP_DAYS}d" -v; then
    echo "OK: $DEST now holds $(rclone lsf "$DEST" --include "/$PATTERN" | wc -l) backups"
  else
    echo "FAILED: rclone reported an error (see the lines above)"
  fi
} >> "$LOG" 2>&1

# Keep the log from growing without bound.
tail -n 400 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
