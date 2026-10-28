param(
    [string]$CommitMsg = "Auto-update from Antigravity: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

$ErrorActionPreference = "Stop"

# Staging semua perubahan
git add .

# Cek status perubahan
$status = git status --porcelain
if (-not $status) {
    Write-Host "Tidak ada perubahan file yang terdeteksi."
} else {
    git commit -m $CommitMsg
    git push -u origin main
    Write-Host "Repositori GitHub berhasil diperbarui!"
}
