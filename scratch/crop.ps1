Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\THUY KIEU\.gemini\antigravity-ide\brain\abc102b7-931c-47fa-9e07-88f891d79918\media__1781514650393.png"
$destPath = "c:\Users\THUY KIEU\OneDrive\Desktop\SWP\Project\swp391-rbl-project-team_4\public\images\movie_toy_story_5.png"

$img = [System.Drawing.Image]::FromFile($srcPath)
Write-Output "Image Dimensions: $($img.Width) x $($img.Height)"

# Exact boundaries of the poster:
$cropX = 114
$cropY = 24
$cropW = 273
$cropH = 402

$bmp = New-Object System.Drawing.Bitmap($cropW, $cropH)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)), (New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)), [System.Drawing.GraphicsUnit]::Pixel)

$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$img.Dispose()

Write-Output "Perfect cropped poster saved to $destPath"
