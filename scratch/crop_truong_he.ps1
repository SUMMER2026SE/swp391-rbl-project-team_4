Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\THUY KIEU\.gemini\antigravity-ide\brain\abc102b7-931c-47fa-9e07-88f891d79918\media__1781520709918.png"
$destPath = "c:\Users\THUY KIEU\OneDrive\Desktop\SWP\Project\swp391-rbl-project-team_4\public\images\movie_truong_he_2001.png"

if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found: $srcPath"
    Exit 1
}

$img = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = $img.Width
$height = $img.Height
Write-Output "Image size: $width x $height"

# The background color is white/light.
# Let's inspect the color of the top-left area of the content (e.g. at x=10, y=100) to find the background color.
$bgPixel = $img.GetPixel(10, 150)
Write-Output "Background sample pixel (10, 150): R=$($bgPixel.R), G=$($bgPixel.G), B=$($bgPixel.B)"

# Scan the left side of the image (x from 20 to 500) to find the colorful poster bounding box.
$minX = $width
$maxX = 0
$minY = $height
$maxY = 0

$threshold = 40

for ($x = 20; $x -lt ($width / 2); $x++) {
    for ($y = 30; $y -lt ($height - 30); $y++) {
        $p = $img.GetPixel($x, $y)
        
        # Calculate color difference from background sample
        $diff = [Math]::Abs($p.R - $bgPixel.R) + [Math]::Abs($p.G - $bgPixel.G) + [Math]::Abs($p.B - $bgPixel.B)
        
        if ($diff -gt $threshold) {
            # Let's check if it's not the black border or text, but the poster itself
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Detected raw bounds: X is $minX to $maxX, Y is $minY to $maxY"

# In the screenshot, the poster is a vertical rectangle. Let's refine based on the raw bounds.
# A movie poster usually has a 2:3 aspect ratio (e.g., width around 300px, height around 450px).
# Let's print out the width and height of the detected bounds.
$detectedW = $maxX - $minX + 1
$detectedH = $maxY - $minY + 1
Write-Output "Detected dimensions: $detectedW x $detectedH"

# Looking at the image, the poster starts at x around 38 and ends at x around 338, and y around 38 to 480.
# Let's do a smart bounding search or just write a script to output the cropped region.
# Let's run this first to see the detected bounds.

# Let's run a test crop.
# We will use the detected bounds if they seem reasonable, or we can adjust them manually.
if ($detectedW -gt 100 -and $detectedH -gt 150) {
    $cropX = $minX
    $cropY = $minY
    $cropW = $detectedW
    $cropH = $detectedH
} else {
    $cropX = 38
    $cropY = 38
    $cropW = 300
    $cropH = 440
}

# Ensure within limits
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
