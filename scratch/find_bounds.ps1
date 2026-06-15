Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\THUY KIEU\.gemini\antigravity-ide\brain\abc102b7-931c-47fa-9e07-88f891d79918\media__1781520709918.png"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = $img.Width
$height = $img.Height

$bgPixel = $img.GetPixel(10, 150)
$bgColor = [System.Drawing.Color]::FromArgb($bgPixel.R, $bgPixel.G, $bgPixel.B)

Write-Output "Image size: $width x $height"
Write-Output "Background color at (10, 150): $bgColor"

# Let's find the poster's left border (minX) and right border (maxX).
# We inspect the horizontal line at y = 150.
$minX = -1
$maxX = -1

for ($x = 10; $x -lt ($width / 2); $x++) {
    $p = $img.GetPixel($x, 150)
    $diff = [Math]::Abs($p.R - $bgPixel.R) + [Math]::Abs($p.G - $bgPixel.G) + [Math]::Abs($p.B - $bgPixel.B)
    
    if ($diff -gt 30) {
        if ($minX -eq -1) {
            $minX = $x
        }
        $maxX = $x
    }
}

# The poster starts at minX. The right edge of the poster is where the color returns to white for a consecutive number of pixels.
# Let's trace from minX to the right.
$lastColorX = $minX
$consecutiveBg = 0
for ($x = $minX; $x -lt ($width / 2); $x++) {
    $p = $img.GetPixel($x, 150)
    $diff = [Math]::Abs($p.R - $bgPixel.R) + [Math]::Abs($p.G - $bgPixel.G) + [Math]::Abs($p.B - $bgPixel.B)
    
    if ($diff -le 30) {
        $consecutiveBg++
        if ($consecutiveBg -gt 15) {
            $maxX = $x - $consecutiveBg
            break
        }
    } else {
        $consecutiveBg = 0
        $lastColorX = $x
    }
}

# Now do the same for Y axis inside the poster's X range (e.g. at x = (minX + maxX)/2)
$midX = [Math]::Floor(($minX + $maxX) / 2)
$minY = -1
$maxY = -1

for ($y = 20; $y -lt ($height - 20); $y++) {
    $p = $img.GetPixel($midX, $y)
    $diff = [Math]::Abs($p.R - $bgPixel.R) + [Math]::Abs($p.G - $bgPixel.G) + [Math]::Abs($p.B - $bgPixel.B)
    
    if ($diff -gt 30) {
        if ($minY -eq -1) {
            $minY = $y
        }
        $maxY = $y
    }
}

# Refine minY and maxY to detect the top and bottom borders of the poster.
# The poster has a white/light gray border or shadow.
# Let's print out the detected coordinates.
Write-Output "Detected Poster Box: X=$minX to $maxX (Width=$($maxX - $minX)), Y=$minY to $maxY (Height=$($maxY - $minY))"

$img.Dispose()
