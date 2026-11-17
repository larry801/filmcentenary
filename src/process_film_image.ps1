param(
    [Parameter(Mandatory=$true)][string]$Id,
    [Parameter(Mandatory=$true)][string]$Title
)

$ErrorActionPreference = 'Stop'
$outDir = 'C:\Users\Muki\OneDrive\film-centary\src\film_image'
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore

function Get-ThumbUrl([string]$title) {
    $encoded = [uri]::EscapeDataString($title)
    $api = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pithumbsize=1600&titles=$encoded"
    $r = Invoke-RestMethod -Uri $api -Method Get
    $pages = $r.query.pages.PSObject.Properties.Value
    foreach($p in $pages){
        if($p.thumbnail -and $p.thumbnail.source){ return $p.thumbnail.source }
    }
    return $null
}

function Load-ImageAny([string]$path) {
    try { return [System.Drawing.Image]::FromFile($path) } catch {
        try {
            $fs = [System.IO.File]::OpenRead($path)
            try {
                $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($fs, [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat, [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
            } finally {
                $fs.Close(); $fs.Dispose()
            }
            $frame = $decoder.Frames[0]
            $pngPath = "$path.conv.png"
            $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
            $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($frame))
            $fo = [System.IO.File]::Open($pngPath, [System.IO.FileMode]::Create)
            try { $enc.Save($fo) } finally { $fo.Close(); $fo.Dispose() }
            return [System.Drawing.Image]::FromFile($pngPath)
        } catch {
            return $null
        }
    }
}

function Do-Process([string]$srcPath,[string]$outPath){
    $targetW=375; $targetH=150; $targetAspect=$targetW/$targetH
    $src = Load-ImageAny $srcPath
    if($null -eq $src){ return $false }
    try {
        $srcW=$src.Width; $srcH=$src.Height; $srcAspect=$srcW/$srcH
        if($srcAspect -gt $targetAspect){
            $cropH=$srcH; $cropW=[int]($cropH*$targetAspect); $cropX=[int](($srcW-$cropW)/2); $cropY=0
        } else {
            $cropW=$srcW; $cropH=[int]($cropW/$targetAspect); $cropX=0; $cropY=[int](($srcH-$cropH)*0.35)
            if($cropY -lt 0){$cropY=0}
            if($cropY+$cropH -gt $srcH){$cropY=$srcH-$cropH}
        }
        $rect = New-Object System.Drawing.Rectangle($cropX,$cropY,$cropW,$cropH)
        $cropped = New-Object System.Drawing.Bitmap($rect.Width,$rect.Height)
        $g1=[System.Drawing.Graphics]::FromImage($cropped)
        $g1.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g1.DrawImage($src,0,0,$rect,[System.Drawing.GraphicsUnit]::Pixel)
        $g1.Dispose()

        $resized = New-Object System.Drawing.Bitmap($targetW,$targetH)
        $g2=[System.Drawing.Graphics]::FromImage($resized)
        $g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g2.DrawImage($cropped,0,0,$targetW,$targetH)
        $g2.Dispose(); $cropped.Dispose()

        $outBmp = New-Object System.Drawing.Bitmap($targetW,$targetH,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g3=[System.Drawing.Graphics]::FromImage($outBmp)
        $g3.Clear([System.Drawing.Color]::Transparent)
        $xOffset=[int]($targetW/3)
        $g3.DrawImage($resized,$xOffset,0)
        $g3.Dispose(); $resized.Dispose()

        for($y=0;$y -lt $targetH;$y++){
            for($x=$xOffset;$x -lt $targetW;$x++){
                $px=$outBmp.GetPixel($x,$y)
                if($px.A -gt 0){
                    $t=($x-$xOffset)/[double]($targetW-1-$xOffset)
                    $a=[int]([math]::Round($px.A*(0.4*$t)))
                    $outBmp.SetPixel($x,$y,[System.Drawing.Color]::FromArgb($a,$px.R,$px.G,$px.B))
                }
            }
        }
        $outBmp.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
        $outBmp.Dispose()
        return $true
    } finally {
        $src.Dispose()
    }
}

$url = Get-ThumbUrl $Title
if([string]::IsNullOrWhiteSpace($url)){
    Write-Output "FAIL $Id no-thumb"
    exit 2
}

$srcPath = Join-Path $outDir "$Id.src"
$outPath = Join-Path $outDir "$Id.png"
Invoke-WebRequest -Uri $url -OutFile $srcPath
$ok = Do-Process $srcPath $outPath
if($ok -and (Test-Path $outPath)){
    $it = Get-Item $outPath
    Write-Output ("OK " + $Id + " " + $it.Length)
    exit 0
}
Write-Output "FAIL $Id process"
exit 3
