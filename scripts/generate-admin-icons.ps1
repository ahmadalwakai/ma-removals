Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$AssetsDir = Join-Path $ProjectRoot "assets"
$ResDir = Join-Path $ProjectRoot "android\app\src\main\res"

function Assert-UnderProject([string]$Path) {
  $resolved = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetFullPath($ProjectRoot)
  if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside project: $resolved"
  }
}

function Color([int]$a, [int]$r, [int]$g, [int]$b) {
  return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function RectF([double]$x, [double]$y, [double]$w, [double]$h) {
  return [System.Drawing.RectangleF]::new([float]$x, [float]$y, [float]$w, [float]$h)
}

function RoundRectPath([double]$x, [double]$y, [double]$w, [double]$h, [double]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = [float]($r * 2)
  $xf = [float]$x
  $yf = [float]$y
  $wf = [float]$w
  $hf = [float]$h
  $path.AddArc($xf, $yf, $d, $d, 180, 90)
  $path.AddArc($xf + $wf - $d, $yf, $d, $d, 270, 90)
  $path.AddArc($xf + $wf - $d, $yf + $hf - $d, $d, $d, 0, 90)
  $path.AddArc($xf, $yf + $hf - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Canvas([int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-CenteredText(
  [System.Drawing.Graphics]$g,
  [string]$text,
  [double]$fontSize,
  [System.Drawing.RectangleF]$rect,
  [System.Drawing.Color]$color,
  [System.Drawing.FontStyle]$style
) {
  $font = [System.Drawing.Font]::new("Segoe UI", [float]$fontSize, $style, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = [System.Drawing.SolidBrush]::new($color)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString($text, $font, $brush, $rect, $format)
  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function Draw-Text(
  [System.Drawing.Graphics]$g,
  [string]$text,
  [double]$fontSize,
  [System.Drawing.RectangleF]$rect,
  [System.Drawing.Color]$color,
  [System.Drawing.FontStyle]$style
) {
  $font = [System.Drawing.Font]::new("Segoe UI", [float]$fontSize, $style, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = [System.Drawing.SolidBrush]::new($color)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Near
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $g.DrawString($text, $font, $brush, $rect, $format)
  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function Fill-Background([System.Drawing.Graphics]$g, [int]$s, [bool]$round) {
  $rect = RectF 0 0 $s $s
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    (Color 255 5 13 28),
    (Color 255 30 64 175),
    135
  )

  if ($round) {
    $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $clip.AddEllipse(0, 0, $s, $s)
    $g.SetClip($clip)
    $g.FillEllipse($brush, 0, 0, $s, $s)
    $clip.Dispose()
  } else {
    $g.FillRectangle($brush, 0, 0, $s, $s)
  }
  $brush.Dispose()

  $routePen = [System.Drawing.Pen]::new((Color 54 147 197 253), [float]($s * 0.018))
  $routePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $routePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($routePen, [float]($s * -0.08), [float]($s * 0.14), [float]($s * 1.16), [float]($s * 0.88), 202, 235)
  $g.DrawArc($routePen, [float]($s * 0.15), [float]($s * 0.08), [float]($s * 0.70), [float]($s * 0.68), 196, 250)
  $routePen.Dispose()

  $gridPen = [System.Drawing.Pen]::new((Color 32 226 232 240), [float]($s * 0.004))
  for ($i = 1; $i -lt 5; $i++) {
    $p = [float]($s * $i / 5)
    $g.DrawLine($gridPen, $p, 0, $p, $s)
    $g.DrawLine($gridPen, 0, $p, $s, $p)
  }
  $gridPen.Dispose()
}

function Draw-TruckMark(
  [System.Drawing.Graphics]$g,
  [int]$s,
  [bool]$monochrome,
  [bool]$compact
) {
  $ink = if ($monochrome) { Color 255 255 255 255 } else { Color 255 255 255 255 }
  $blue = if ($monochrome) { Color 255 255 255 255 } else { Color 255 59 130 246 }
  $cyan = if ($monochrome) { Color 255 255 255 255 } else { Color 255 125 211 252 }
  $dark = if ($monochrome) { Color 255 255 255 255 } else { Color 255 15 23 42 }

  $scale = if ($compact) { 0.88 } else { 1.0 }
  $cx = $s * 0.5
  $topFactor = if ($compact) { 0.18 } else { 0.14 }
  $top = $s * $topFactor

  if (-not $monochrome) {
    $panelPath = RoundRectPath ($s * 0.135) ($s * 0.135) ($s * 0.73) ($s * 0.73) ($s * 0.12)
    $panelBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      (RectF ($s * 0.135) ($s * 0.135) ($s * 0.73) ($s * 0.73)),
      (Color 238 15 23 42),
      (Color 226 30 64 175),
      90
    )
    $g.FillPath($panelBrush, $panelPath)
    $panelPen = [System.Drawing.Pen]::new((Color 150 191 219 254), [float]($s * 0.012))
    $g.DrawPath($panelPen, $panelPath)
    $panelPen.Dispose()
    $panelBrush.Dispose()
    $panelPath.Dispose()
  }

  $arrowPen = [System.Drawing.Pen]::new($cyan, [float]($s * 0.035 * $scale))
  $arrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $arrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawBezier(
    $arrowPen,
    [System.Drawing.PointF]::new([float]($s * 0.24), [float]($s * 0.61)),
    [System.Drawing.PointF]::new([float]($s * 0.42), [float]($s * 0.42)),
    [System.Drawing.PointF]::new([float]($s * 0.58), [float]($s * 0.42)),
    [System.Drawing.PointF]::new([float]($s * 0.76), [float]($s * 0.61))
  )
  $g.DrawLine($arrowPen, [float]($s * 0.735), [float]($s * 0.56), [float]($s * 0.79), [float]($s * 0.61))
  $g.DrawLine($arrowPen, [float]($s * 0.735), [float]($s * 0.66), [float]($s * 0.79), [float]($s * 0.61))
  $arrowPen.Dispose()

  Draw-CenteredText $g "M&A" ($s * 0.175 * $scale) (RectF ($s * 0.16) $top ($s * 0.68) ($s * 0.24)) $ink ([System.Drawing.FontStyle]::Bold)

  if (-not $compact) {
    $adminColor = if ($monochrome) { $ink } else { Color 255 191 219 254 }
    Draw-CenteredText $g "ADMIN" ($s * 0.055) (RectF ($s * 0.25) ($s * 0.34) ($s * 0.50) ($s * 0.08)) $adminColor ([System.Drawing.FontStyle]::Bold)
  }

  $truckY = $s * 0.58
  $truckX = $s * 0.20
  $truckW = $s * 0.60
  $truckH = $s * 0.17

  $bodyPath = RoundRectPath $truckX $truckY ($truckW * 0.64) $truckH ($s * 0.035)
  $bodyBrush = [System.Drawing.SolidBrush]::new($blue)
  $g.FillPath($bodyBrush, $bodyPath)
  $bodyBrush.Dispose()
  $bodyPath.Dispose()

  $cabPath = RoundRectPath ($truckX + ($truckW * 0.58)) ($truckY + ($truckH * 0.18)) ($truckW * 0.27) ($truckH * 0.82) ($s * 0.030)
  $cabBrush = [System.Drawing.SolidBrush]::new($cyan)
  $g.FillPath($cabBrush, $cabPath)
  $cabBrush.Dispose()
  $cabPath.Dispose()

  $windowColor = if ($monochrome) { Color 0 255 255 255 } else { Color 255 219 234 254 }
  $windowBrush = [System.Drawing.SolidBrush]::new($windowColor)
  $g.FillPolygon(
    $windowBrush,
    [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new([float]($truckX + $truckW * 0.64), [float]($truckY + $truckH * 0.30)),
      [System.Drawing.PointF]::new([float]($truckX + $truckW * 0.76), [float]($truckY + $truckH * 0.30)),
      [System.Drawing.PointF]::new([float]($truckX + $truckW * 0.80), [float]($truckY + $truckH * 0.57)),
      [System.Drawing.PointF]::new([float]($truckX + $truckW * 0.64), [float]($truckY + $truckH * 0.57))
    )
  )
  $windowBrush.Dispose()

  $wheelBrush = [System.Drawing.SolidBrush]::new($dark)
  $wheelInner = [System.Drawing.SolidBrush]::new($ink)
  foreach ($wx in @(($truckX + ($truckW * 0.20)), ($truckX + ($truckW * 0.68)))) {
    $g.FillEllipse($wheelBrush, [float]($wx - $s * 0.052), [float]($truckY + $truckH * 0.70), [float]($s * 0.104), [float]($s * 0.104))
    $g.FillEllipse($wheelInner, [float]($wx - $s * 0.024), [float]($truckY + $truckH * 0.728), [float]($s * 0.048), [float]($s * 0.048))
  }
  $wheelInner.Dispose()
  $wheelBrush.Dispose()

  if (-not $monochrome) {
    $badgeBrush = [System.Drawing.SolidBrush]::new((Color 255 34 197 94))
    $badgePen = [System.Drawing.Pen]::new((Color 255 220 252 231), [float]($s * 0.010))
    $g.FillEllipse($badgeBrush, [float]($s * 0.70), [float]($s * 0.19), [float]($s * 0.115), [float]($s * 0.115))
    $g.DrawEllipse($badgePen, [float]($s * 0.70), [float]($s * 0.19), [float]($s * 0.115), [float]($s * 0.115))
    $badgeBrush.Dispose()
    $badgePen.Dispose()
    Draw-CenteredText $g "!" ($s * 0.065) (RectF ($s * 0.70) ($s * 0.185) ($s * 0.115) ($s * 0.115)) (Color 255 5 46 22) ([System.Drawing.FontStyle]::Bold)
  }
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$path) {
  Assert-UnderProject $path
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-AppIcon([int]$size, [string]$path, [bool]$round = $false) {
  $canvas = New-Canvas $size
  try {
    Fill-Background $canvas.Graphics $size $round
    Draw-TruckMark $canvas.Graphics $size $false $false
    Save-Png $canvas.Bitmap $path
  } finally {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
  }
}

function New-AdaptiveForeground([int]$size, [string]$path, [bool]$mono = $false) {
  $canvas = New-Canvas $size
  try {
    $canvas.Graphics.Clear([System.Drawing.Color]::Transparent)
    Draw-TruckMark $canvas.Graphics $size $mono $true
    Save-Png $canvas.Bitmap $path
  } finally {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
  }
}

function New-AdaptiveBackground([int]$size, [string]$path) {
  $canvas = New-Canvas $size
  try {
    Fill-Background $canvas.Graphics $size $false
    Save-Png $canvas.Bitmap $path
  } finally {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
  }
}

function New-Splash([int]$size, [string]$path) {
  $canvas = New-Canvas $size
  try {
    $canvas.Graphics.Clear([System.Drawing.Color]::Transparent)
    Draw-TruckMark $canvas.Graphics $size $false $false
    Save-Png $canvas.Bitmap $path
  } finally {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
  }
}

$CanonicalLogoPath = Join-Path (Split-Path $ProjectRoot -Parent) "ma-removals\public\images\logo.png"
if (-not (Test-Path -LiteralPath $CanonicalLogoPath)) {
  throw "Project logo was not found at $CanonicalLogoPath"
}

$script:CanonicalLogo = [System.Drawing.Image]::FromFile($CanonicalLogoPath)

function New-LogoAsset([int]$size, [string]$path, [double]$scale = 0.94, [string]$background = "") {
  Assert-UnderProject $path
  $canvas = New-Canvas $size
  try {
    if ([string]::IsNullOrWhiteSpace($background)) {
      $canvas.Graphics.Clear([System.Drawing.Color]::Transparent)
    } else {
      $canvas.Graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($background))
    }

    $target = $size * $scale
    $ratio = [Math]::Min($target / $script:CanonicalLogo.Width, $target / $script:CanonicalLogo.Height)
    $width = $script:CanonicalLogo.Width * $ratio
    $height = $script:CanonicalLogo.Height * $ratio
    $x = ($size - $width) / 2
    $y = ($size - $height) / 2
    $canvas.Graphics.DrawImage($script:CanonicalLogo, (RectF $x $y $width $height))
    Save-Png $canvas.Bitmap $path
  } finally {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
  }
}

try {
  New-LogoAsset 1024 (Join-Path $AssetsDir "icon.png") 1.0
  New-LogoAsset 1024 (Join-Path $AssetsDir "android-icon-foreground.png") 0.72
  New-LogoAsset 1024 (Join-Path $AssetsDir "android-icon-background.png") 1.0 "#FFFFFF"
  New-LogoAsset 1024 (Join-Path $AssetsDir "android-icon-monochrome.png") 0.72
  New-LogoAsset 512 (Join-Path $AssetsDir "splash-icon.png") 0.86
  New-LogoAsset 64 (Join-Path $AssetsDir "favicon.png") 1.0
} finally {
  $script:CanonicalLogo.Dispose()
}

$density = @{
  "mipmap-mdpi" = @{ legacy = 48; adaptive = 108 }
  "mipmap-hdpi" = @{ legacy = 72; adaptive = 162 }
  "mipmap-xhdpi" = @{ legacy = 96; adaptive = 216 }
  "mipmap-xxhdpi" = @{ legacy = 144; adaptive = 324 }
  "mipmap-xxxhdpi" = @{ legacy = 192; adaptive = 432 }
}

foreach ($entry in $density.GetEnumerator()) {
  $dir = Join-Path $ResDir $entry.Key
  Assert-UnderProject $dir
  Get-ChildItem -Path $dir -Filter "ic_launcher*.webp" -File | ForEach-Object {
    Assert-UnderProject $_.FullName
    Remove-Item -LiteralPath $_.FullName
  }
  $script:CanonicalLogo = [System.Drawing.Image]::FromFile($CanonicalLogoPath)
  try {
    New-LogoAsset $entry.Value.legacy (Join-Path $dir "ic_launcher.png") 1.0
    New-LogoAsset $entry.Value.legacy (Join-Path $dir "ic_launcher_round.png") 1.0
    New-LogoAsset $entry.Value.adaptive (Join-Path $dir "ic_launcher_background.png") 1.0 "#FFFFFF"
    New-LogoAsset $entry.Value.adaptive (Join-Path $dir "ic_launcher_foreground.png") 0.72
    New-LogoAsset $entry.Value.adaptive (Join-Path $dir "ic_launcher_monochrome.png") 0.72
  } finally {
    $script:CanonicalLogo.Dispose()
  }
}

$splashDensity = @{
  "drawable-mdpi" = 96
  "drawable-hdpi" = 144
  "drawable-xhdpi" = 192
  "drawable-xxhdpi" = 288
  "drawable-xxxhdpi" = 384
}

foreach ($entry in $splashDensity.GetEnumerator()) {
  $dir = Join-Path $ResDir $entry.Key
  $script:CanonicalLogo = [System.Drawing.Image]::FromFile($CanonicalLogoPath)
  try {
    New-LogoAsset $entry.Value (Join-Path $dir "splashscreen_logo.png") 0.86
  } finally {
    $script:CanonicalLogo.Dispose()
  }
}

Write-Host "Generated MA Removals project logo assets and Android launcher resources."
