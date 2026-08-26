# Composites a map-preview PNG from render-map.ts / render-ascii.ts JSON.
# Draw commands may reference two sheets: 0 = main DTII sheet, 1 = walls atlas.
# Usage: pwsh scripts/compose-map.ps1 -Json map.json -Out map.png [-Scale 3]
param(
  [Parameter(Mandatory = $true)][string]$Json,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Scale = 3,
  [string]$Sheet = '',
  [string]$WallSheet = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not $Sheet) {
  $Sheet = (Resolve-Path (Join-Path $PSScriptRoot '..\public\assets\dtii\dungeon_sheet.png')).Path
}
if (-not $WallSheet) {
  $WallSheet = (Resolve-Path (Join-Path $PSScriptRoot '..\public\assets\dtii\walls_high.png')).Path
}
$data = Get-Content $Json -Raw | ConvertFrom-Json
$sheets = @([System.Drawing.Bitmap]::new($Sheet), [System.Drawing.Bitmap]::new($WallSheet))
[int]$cell = 16 * $Scale
[int]$dim = [int]$data.size * $cell

$img = [System.Drawing.Bitmap]::new($dim, $dim)
$g = [System.Drawing.Graphics]::FromImage($img)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.Clear([System.Drawing.Color]::FromArgb(255, 12, 12, 16))
foreach ($d in $data.draws) {
  $src = $sheets[[int]($d.sheet ?? 0)]
  $sr = [System.Drawing.Rectangle]::new([int]$d.s[0], [int]$d.s[1], [int]$d.s[2], [int]$d.s[3])
  $dy = 0; if ($null -ne $d.dy) { $dy = [int]$d.dy }
  $dst = [System.Drawing.Rectangle]::new(
    [int]($d.x * $cell),
    [int]($d.y * $cell + $dy * $Scale),
    [int]($d.s[2] * $Scale),
    [int]($d.s[3] * $Scale))
  $g.DrawImage($src, $dst, $sr, [System.Drawing.GraphicsUnit]::Pixel)
}
$g.Dispose()
$img.Save($Out)
$img.Dispose()
foreach ($s in $sheets) { $s.Dispose() }
Write-Output "saved $Out ($dim x $dim)"
