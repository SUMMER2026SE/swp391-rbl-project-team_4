Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\THUY KIEU\.gemini\antigravity-ide\brain\abc102b7-931c-47fa-9e07-88f891d79918\media__1781520709918.png"
$destPath = "c:\Users\THUY KIEU\OneDrive\Desktop\SWP\Project\swp391-rbl-project-team_4\public\images\movie_truong_he_2001.png"

$img = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = $img.Width
$height = $img.Height

# Exact coordinates based on layout and aspect ratio
$cropX = 35
$cropY = 32
$cropW = 283
$cropH = 412

if ($cropX + $cropW -gt $width) { $cropW = $width - $cropX }
if ($cropY + $cropH -gt $height) { $cropH = $height - $cropY }

$bmp = New-Object System.Drawing.Bitmap($cropW, $cropH)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)), (New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)), [System.Drawing.GraphicsUnit]::Pixel)

$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$img.Dispose()

Write-Output "Cropped poster saved to $destPath"
