param(
    [string]$OutputPath
)

Add-Type -AssemblyName System.Windows.Forms

$data = [System.Windows.Forms.Clipboard]::GetDataObject()

if ($null -eq $data) {
    Write-Error "Clipboard is unavailable."
    exit 1
}

Write-Output "=== CLIPBOARD FORMATS ==="

$formats = $data.GetFormats()

foreach ($format in $formats) {
    Write-Output " - $format"
}

Write-Output ""
Write-Output "=== HTML CHECK ==="

$html = $null

if ($data.GetDataPresent("HTML Format")) {
    $raw = $data.GetData("HTML Format", $false)
    $bytes = $null

    if ($raw -is [System.IO.MemoryStream]) {
        $bytes = $raw.ToArray()
    } elseif ($raw -is [System.IO.Stream]) {
        if ($raw.CanSeek) {
            $raw.Position = 0
        }

        $memory = [System.IO.MemoryStream]::new()
        $raw.CopyTo($memory)
        $bytes = $memory.ToArray()
        $memory.Dispose()
    } elseif ($raw -is [byte[]]) {
        $bytes = $raw
    } elseif ($raw -is [string]) {
        $html = $raw
    }

    if ($bytes -and $bytes.Length -gt 0) {
        $encoding = [System.Text.UTF8Encoding]::new($false, $true)
        $html = $encoding.GetString($bytes).TrimStart([char]0xFEFF).TrimEnd([char]0)
    }
}

if (-not $html) {
    try {
        $html = [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html)
    } catch {
        $html = $null
    }
}

if ($html) {
    Write-Output "HTML FORMAT FOUND!"

    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
        $OutputPath = Join-Path (Get-Location) "clipboard.html"
    }

    # Preserve the decoded HTML as UTF-8 without a byte-order mark.
    [System.IO.File]::WriteAllText(
        $OutputPath,
        $html,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Output ""
    Write-Output "HTML saved to:"
    Write-Output $OutputPath
    Write-Output ""
    Write-Output "HTML length: $($html.Length) characters"

} else {

    Write-Output "NO HTML FORMAT FOUND."
}