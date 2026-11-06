$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$icons = @(
  @{ folder = 'ZCode'; logo = 'zcode.png' },
  @{ folder = 'Qoder'; logo = 'qoder.png' },
  @{ folder = 'DeepSeekHarness'; logo = 'deepseek.png' },
  @{ folder = 'Antigravity'; logo = 'antigravity.png' },
  @{ folder = 'OpenCode'; logo = 'opencode.png' },
  @{ folder = 'Claude'; logo = 'claude.png' }
)

function New-RoundedRectanglePath([Drawing.RectangleF]$Rectangle, [single]$Radius) {
  $diameter = [Math]::Min($Radius * 2, [Math]::Min($Rectangle.Width, $Rectangle.Height))
  $path = [Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

foreach ($entry in $icons) {
  $logoPath = Join-Path $root "apps\desktop\src\assets\apps\$($entry.logo)"
  $outputPath = Join-Path $root "apps\$($entry.folder)\rtl-shortcut.ico"
  $logo = [Drawing.Image]::FromFile($logoPath)
  try {
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $frames = [Collections.Generic.List[byte[]]]::new()
    foreach ($size in $sizes) {
      $frame = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $graphics = [Drawing.Graphics]::FromImage($frame)
      $png = [IO.MemoryStream]::new()
      try {
        $graphics.Clear([Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit

        $logoScale = [Math]::Min(($size * 0.92) / $logo.Width, ($size * 0.92) / $logo.Height)
        $logoWidth = [single]($logo.Width * $logoScale)
        $logoHeight = [single]($logo.Height * $logoScale)
        $graphics.DrawImage($logo, [single](($size - $logoWidth) / 2), [single](($size - $logoHeight) / 2), $logoWidth, $logoHeight)

        # Render the badge at each native icon size so the RTL letters stay legible at 16–24 px.
        $margin = [single][Math]::Max(0.5, $size * 0.015)
        $badgeWidth = [single][Math]::Max(9, $size * 0.48)
        $badgeHeight = [single][Math]::Max(5.4, $size * 0.22)
        $badge = [Drawing.RectangleF]::new($size - $badgeWidth - $margin, $size - $badgeHeight - $margin, $badgeWidth, $badgeHeight)
        $outer = New-RoundedRectanglePath $badge ([single][Math]::Max(1, $size * 0.045))
        try { $graphics.FillPath([Drawing.Brushes]::White, $outer) } finally { $outer.Dispose() }

        $inset = [single][Math]::Max(0.45, $size * 0.018)
        $inner = [Drawing.RectangleF]::new($badge.X + $inset, $badge.Y + $inset, $badge.Width - 2 * $inset, $badge.Height - 2 * $inset)
        $innerPath = New-RoundedRectanglePath $inner ([single][Math]::Max(0.6, $size * 0.03))
        $badgeBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 207, 93, 49))
        $font = [Drawing.Font]::new('Arial', [single][Math]::Max(3.6, $size * 0.22), [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
        $format = [Drawing.StringFormat]::new()
        try {
          $graphics.FillPath($badgeBrush, $innerPath)
          $format.Alignment = [Drawing.StringAlignment]::Center
          $format.LineAlignment = [Drawing.StringAlignment]::Center
          $format.FormatFlags = [Drawing.StringFormatFlags]::NoWrap
          $graphics.DrawString('RTL', $font, [Drawing.Brushes]::White, $inner, $format)
        } finally {
          $format.Dispose()
          $font.Dispose()
          $badgeBrush.Dispose()
          $innerPath.Dispose()
        }

        $frame.Save($png, [Drawing.Imaging.ImageFormat]::Png)
        $frames.Add($png.ToArray())
      } finally { $png.Dispose(); $graphics.Dispose(); $frame.Dispose() }
    }

    $stream = [IO.MemoryStream]::new()
    $writer = [IO.BinaryWriter]::new($stream)
    try {
      $writer.Write([UInt16]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]$sizes.Count)
      $offset = 6 + 16 * $sizes.Count
      for ($i = 0; $i -lt $sizes.Count; $i++) {
        $encodedSize = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write([byte]$encodedSize)
        $writer.Write([byte]$encodedSize)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$frames[$i].Length)
        $writer.Write([UInt32]$offset)
        $offset += $frames[$i].Length
      }
      foreach ($frameData in $frames) { $writer.Write($frameData) }
      [IO.File]::WriteAllBytes($outputPath, $stream.ToArray())
    } finally { $writer.Dispose(); $stream.Dispose() }
    Write-Output "Created $outputPath"
  } finally { $logo.Dispose() }
}
