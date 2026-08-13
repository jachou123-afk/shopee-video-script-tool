Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$assetDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputPath = Join-Path $assetDir "rich-menu-v2.png"
$width = 2500
$height = 1686
$rowHeight = 843
$columnWidths = @(833, 833, 834)

$bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::FromArgb(255, 244, 241, 232))

$fontFamily = New-Object System.Drawing.FontFamily("Microsoft JhengHei UI")
$titleFont = New-Object System.Drawing.Font($fontFamily, 70, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = New-Object System.Drawing.Font($fontFamily, 35, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$hintFont = New-Object System.Drawing.Font($fontFamily, 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$subtitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 255, 255, 255))
$hintBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(175, 255, 255, 255))
$iconBackdrop = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34, 255, 255, 255))
$dividerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 244, 241, 232), 5)

$centerFormat = New-Object System.Drawing.StringFormat
$centerFormat.Alignment = [System.Drawing.StringAlignment]::Center
$centerFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

function New-RoundPen([int]$widthValue) {
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $widthValue)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Draw-Icon([System.Drawing.Graphics]$canvas, [string]$icon, [float]$centerX, [float]$centerY) {
  $pen = New-RoundPen 20
  $thinPen = New-RoundPen 14
  $fill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  try {
    switch ($icon) {
      "search" {
        $canvas.DrawEllipse($pen, $centerX - 55, $centerY - 60, 95, 95)
        $canvas.DrawLine($pen, $centerX + 20, $centerY + 20, $centerX + 72, $centerY + 72)
        $canvas.DrawLine($thinPen, $centerX - 12, $centerY + 60, $centerX + 50, $centerY + 60)
      }
      "list" {
        $canvas.DrawRectangle($pen, $centerX - 62, $centerY - 70, 124, 142)
        foreach ($offset in @(-36, 0, 36)) {
          $canvas.FillEllipse($fill, $centerX - 37, $centerY + $offset - 7, 14, 14)
          $canvas.DrawLine($thinPen, $centerX - 8, $centerY + $offset, $centerX + 40, $centerY + $offset)
        }
      }
      "plus" {
        $canvas.DrawEllipse($pen, $centerX - 68, $centerY - 68, 136, 136)
        $canvas.DrawLine($pen, $centerX - 35, $centerY, $centerX + 35, $centerY)
        $canvas.DrawLine($pen, $centerX, $centerY - 35, $centerX, $centerY + 35)
      }
      "check" {
        $canvas.DrawEllipse($pen, $centerX - 68, $centerY - 68, 136, 136)
        $canvas.DrawLines($pen, [System.Drawing.PointF[]]@(
          [System.Drawing.PointF]::new([float]($centerX - 38), [float]($centerY + 2)),
          [System.Drawing.PointF]::new([float]($centerX - 8), [float]($centerY + 34)),
          [System.Drawing.PointF]::new([float]($centerX + 48), [float]($centerY - 32))
        ))
      }
      "document" {
        $canvas.DrawRectangle($pen, $centerX - 58, $centerY - 72, 116, 144)
        $canvas.DrawLine($thinPen, $centerX - 32, $centerY - 30, $centerX + 30, $centerY - 30)
        $canvas.DrawLine($thinPen, $centerX - 32, $centerY + 4, $centerX + 20, $centerY + 4)
        $canvas.DrawLine($pen, $centerX + 2, $centerY + 48, $centerX + 70, $centerY - 20)
      }
      "help" {
        $canvas.DrawEllipse($pen, $centerX - 68, $centerY - 68, 136, 136)
        $canvas.DrawArc($pen, $centerX - 30, $centerY - 38, 60, 58, 200, 250)
        $canvas.DrawLine($pen, $centerX, $centerY + 18, $centerX, $centerY + 28)
        $canvas.FillEllipse($fill, $centerX - 10, $centerY + 47, 20, 20)
      }
    }
  } finally {
    $pen.Dispose()
    $thinPen.Dispose()
    $fill.Dispose()
  }
}

$tiles = @(
  @{ Label = "查商品／儲位"; Subtitle = "輸入貨號或商品關鍵字"; Icon = "search"; Top = "#155A46"; Bottom = "#104637" },
  @{ Label = "要拍什麼"; Subtitle = "查看目前待拍清單"; Icon = "list"; Top = "#1B6851"; Bottom = "#14513F" },
  @{ Label = "新增排程"; Subtitle = "貼上商品連結加入待拍"; Icon = "plus"; Top = "#28755E"; Bottom = "#1C5D49" },
  @{ Label = "已拍完"; Subtitle = "查看完成時間與明細"; Icon = "check"; Top = "#205F4D"; Bottom = "#174839" },
  @{ Label = "產生文案"; Subtitle = "40 秒 AI 標準版腳本"; Icon = "document"; Top = "#2C765F"; Bottom = "#1E5B49" },
  @{ Label = "使用說明"; Subtitle = "查看全部指令與快捷鍵"; Icon = "help"; Top = "#3A806A"; Bottom = "#28614F" }
)

for ($index = 0; $index -lt $tiles.Count; $index++) {
  $column = $index % 3
  $row = [Math]::Floor($index / 3)
  $x = 0
  for ($i = 0; $i -lt $column; $i++) { $x += $columnWidths[$i] }
  $y = $row * $rowHeight
  $tileWidth = $columnWidths[$column]
  $tile = $tiles[$index]
  $rect = [System.Drawing.Rectangle]::new([int]$x, [int]$y, [int]$tileWidth, [int]$rowHeight)
  $topColor = [System.Drawing.ColorTranslator]::FromHtml($tile.Top)
  $bottomColor = [System.Drawing.ColorTranslator]::FromHtml($tile.Bottom)
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $topColor, $bottomColor, 90)
  try { $graphics.FillRectangle($gradient, $rect) } finally { $gradient.Dispose() }

  $centerX = $x + ($tileWidth / 2)
  $iconY = $y + 225
  $graphics.FillEllipse($iconBackdrop, $centerX - 115, $iconY - 115, 230, 230)
  Draw-Icon $graphics $tile.Icon $centerX $iconY

  $titleRect = [System.Drawing.RectangleF]::new([float]($x + 30), [float]($y + 370), [float]($tileWidth - 60), 105)
  $subtitleRect = [System.Drawing.RectangleF]::new([float]($x + 35), [float]($y + 485), [float]($tileWidth - 70), 70)
  $hintRect = [System.Drawing.RectangleF]::new([float]($x + 35), [float]($y + 690), [float]($tileWidth - 70), 55)
  $graphics.DrawString($tile.Label, $titleFont, $whiteBrush, $titleRect, $centerFormat)
  $graphics.DrawString($tile.Subtitle, $subtitleFont, $subtitleBrush, $subtitleRect, $centerFormat)
  $graphics.DrawString("點一下開始", $hintFont, $hintBrush, $hintRect, $centerFormat)
}

$graphics.DrawLine($dividerPen, 833, 0, 833, $height)
$graphics.DrawLine($dividerPen, 1666, 0, 1666, $height)
$graphics.DrawLine($dividerPen, 0, $rowHeight, $width, $rowHeight)

try {
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $outputPath
} finally {
  $dividerPen.Dispose()
  $iconBackdrop.Dispose()
  $hintBrush.Dispose()
  $subtitleBrush.Dispose()
  $whiteBrush.Dispose()
  $hintFont.Dispose()
  $subtitleFont.Dispose()
  $titleFont.Dispose()
  $fontFamily.Dispose()
  $centerFormat.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
