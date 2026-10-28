#!/bin/bash
set -e

COMMIT_MSG="${1:-Auto-update from Antigravity: $(date '+%Y-%m-%d %H:%M:%S')}"

# Staging semua perubahan
git add .

# Cek apakah ada perubahan yang perlu di-commit (aman untuk repo baru maupun yang sudah memiliki commit)
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    NO_CHANGES=$(git diff-index --quiet HEAD -- && echo "yes" || echo "no")
else
    NO_CHANGES=$(git diff --cached --quiet && echo "yes" || echo "no")
fi

if [ "$NO_CHANGES" = "yes" ]; then
    echo "Tidak ada perubahan file yang terdeteksi."
else
    git commit -m "$COMMIT_MSG"
    git push -u origin main
    echo "Repositori GitHub berhasil diperbarui!"
fi
