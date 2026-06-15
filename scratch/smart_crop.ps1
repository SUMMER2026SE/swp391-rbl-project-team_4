Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\THUY KIEU\.gemini\antigravity-ide\brain\abc102b7-931c-47fa-9e07-88f891d79918\media__1781514650393.png"
$destPath = "c:\Users\THUY KIEU\OneDrive\Desktop\SWP\Project\swp391-rbl-project-team_4\public\images\movie_toy_story_5.png"

$img = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = $img.Width
$height = $img.Height

# We want to find the colorful poster rectangle on the left side of the screenshot.
# The background is white/light or dark.
# Let's inspect the color of the top-left area to determine the background color.
$bgPixel = $img.GetPixel(10, 10)
Write-Output "Background sample pixel: R=$($bgPixel.R), G=$($bgPixel.G), B=$($bgPixel.B)"

# We scan the left half of the image (x from 50 to 500) to find the poster bounding box.
# The poster has a distinct colorful boundary. We can look for pixels that differ significantly from the background.
$minX = $width
$maxX = 0
$minY = $height
$maxY = 0

# Threshold for color difference
$threshold = 30

for ($x = 50; $x -lt ($width / 2); $x++) {
    for ($y = 10; $y -lt ($height - 10); $y++) {
        $p = $img.GetPixel($x, $y)
        
        # Calculate distance from background sample
        $diff = [Math]::Abs($p.R - $bgPixel.R) + [Math]::Abs($p.G - $bgPixel.G) + [Math]::Abs($p.B - $bgPixel.B)
        
        # If it differs significantly from the background, it's part of the poster/content
        if ($diff -gt $threshold) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Detected raw bounds: X is $minX to $maxX, Y is $minY to $maxY"

# In the screenshot, the poster is a vertical rectangle.
# Let's refine the bounding box. The poster in the user's screenshot starts at x around 113, and ends at x around 387 (width ~ 274).
# It starts at y around 25 and ends at y around 409 (height ~ 384).
# Let's use the detected bounds if they make sense, otherwise fallback to the standard crop.
if ($minX -lt $width -and $maxX -gt $minX -and ($maxX - $minX) -gt 150) {
    # Add a tiny margin or crop exactly
    $cropX = $minX
    $cropY = $minY
    $cropW = $maxX - $minX + 1
    $cropH = $maxY - $minY + 1
    Write-Output "Using smart bounds: x=$cropX, y=$cropY, w=$cropW, h=$cropH"
} else {
    $cropX = 113
    $cropY = 25
    $cropW = 274
    $cropH = 384
    Write-Output "Falling back to default bounds: x=$cropX, y=$cropY, w=$cropW, h=$cropH"
}

# Ensure within image limits
if ($cropX + $cropW -gt $width) { $cropW = $width - $cropX }
if ($cropY + $cropH -gt $height) { $cropH = $height - $cropY }

# Save cropped
$bmp = New-Object System.Drawing.Bitmap($cropW, $cropH)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)), (New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)), [System.Drawing.GraphicsUnit]::Pixel)

$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$img.Dispose()

Write-Output "Smart cropped poster saved to $destPath"
