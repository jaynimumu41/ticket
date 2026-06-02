param(
  [int]$Port = 4177
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$rootWithSlash = $root.TrimEnd('\') + '\'
$listener = [System.Net.HttpListener]::new()
$prefix = "http://+:$Port/"
$listener.Prefixes.Add($prefix)

# Get LAN IP for display
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } | Select-Object -First 1).IPAddress
Write-Host ""
Write-Host "  本機：  http://localhost:$Port" -ForegroundColor Cyan
if ($lanIp) {
  Write-Host "  手機：  http://${lanIp}:$Port" -ForegroundColor Green
}
Write-Host ""
Write-Host "  (如提示需要管理員權限，請以系統管理員身份執行 PowerShell)" -ForegroundColor Yellow
Write-Host ""

$fareSources = @{
  CI = @(
    'https://flights.china-airlines.com/en-tw/flights-from-taipei-to-japan',
    'https://flights.china-airlines.com/en-tw/flights-from-taiwan-to-japan'
  )
  JX = @(
    'https://www.starlux-airlines.com/flights/en/flights-from-taipei-to-japan',
    'https://www.starlux-airlines.com/flights/en-tw/flights-from-taipei-to-japan'
  )
  BR = @(
    'https://flights.evaair.com/en-tw/flights-from-taipei-to-japan',
    'https://flights.evaair.com/en-tw/flights-from-taiwan-to-japan'
  )
}

function Send-Text {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [int]$StatusCode,
    [string]$Text
  )
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = 'text/plain; charset=utf-8'
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-Json {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [object]$Payload
  )
  $json = $Payload | ConvertTo-Json -Depth 8
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Response.StatusCode = 200
  $Response.ContentType = 'application/json; charset=utf-8'
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Get-ContentType {
  param([string]$Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8'; break }
    '.css' { 'text/css; charset=utf-8'; break }
    '.js' { 'text/javascript; charset=utf-8'; break }
    '.json' { 'application/json; charset=utf-8'; break }
    '.webmanifest' { 'application/manifest+json; charset=utf-8'; break }
    '.svg' { 'image/svg+xml; charset=utf-8'; break }
    '.png' { 'image/png'; break }
    '.jpg' { 'image/jpeg'; break }
    '.jpeg' { 'image/jpeg'; break }
    '.webp' { 'image/webp'; break }
    default { 'application/octet-stream' }
  }
}

function ConvertTo-PlainText {
  param([string]$Html)
  $text = [regex]::Replace($Html, '(?is)<script.*?</script>', ' ')
  $text = [regex]::Replace($text, '(?is)<style.*?</style>', ' ')
  $text = [regex]::Replace($text, '(?is)<[^>]+>', ' ')
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  $text = [regex]::Replace($text, '\s+', ' ')
  return $text.Trim()
}

function Normalize-LiveDate {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }

  $clean = $Value.Trim() -replace '\s+', ' '
  $formats = @(
    'yyyy/MM/dd',
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'dd MMM yy',
    'dd MMM yyyy'
  )

  foreach ($format in $formats) {
    try {
      $date = [datetime]::ParseExact($clean, $format, [System.Globalization.CultureInfo]::InvariantCulture)
      return $date.ToString('yyyy-MM-dd')
    } catch {
    }
  }

  try {
    return ([datetime]::Parse($clean, [System.Globalization.CultureInfo]::InvariantCulture)).ToString('yyyy-MM-dd')
  } catch {
    return $null
  }
}

function New-FareObject {
  param(
    [string]$Airline,
    [string]$From,
    [string]$To,
    [string]$Depart,
    [string]$Return,
    [string]$Price,
    [string]$SourceUrl
  )

  $departDate = Normalize-LiveDate -Value $Depart
  $returnDate = Normalize-LiveDate -Value $Return
  if (-not $departDate -or -not $returnDate) { return $null }

  $numericPrice = [int](($Price -replace '[^\d]', ''))
  if ($numericPrice -le 0) { return $null }

  [pscustomobject]@{
    airline = $Airline
    from = $From.ToUpperInvariant()
    to = $To.ToUpperInvariant()
    departDate = $departDate
    returnDate = $returnDate
    price = $numericPrice
    source = 'official public fare page'
    sourceUrl = $SourceUrl
    bookingUrl = $SourceUrl
    seenAt = (Get-Date).ToString('yyyy-MM-dd')
  }
}

function Extract-Fares {
  param(
    [string]$Airline,
    [string]$PlainText,
    [string]$SourceUrl
  )

  $patterns = @(
    'Taipei\s*\((?<from>[A-Z]{3})\)\s*(?:to|-)\s*[^()]{1,70}\((?<to>[A-Z]{3})\)\s*(?<depart>\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*-\s*(?<return>\d{4}[/-]\d{1,2}[/-]\d{1,2}).{0,140}?From\s*TWD\s*[\u00a0 ]*(?<price>[\d,]+)',
    'Taipei\s*\((?<from>[A-Z]{3})\)\s*(?:to|-)\s*[^()]{1,70}\((?<to>[A-Z]{3})\)\s*(?<depart>\d{1,2}/\d{1,2}/\d{4})\s*-\s*(?<return>\d{1,2}/\d{1,2}/\d{4}).{0,140}?From\s*TWD\s*[\u00a0 ]*(?<price>[\d,]+)',
    'Taipei\s*\((?<from>[A-Z]{3})\)\s*(?:to|-)\s*[^()]{1,70}\((?<to>[A-Z]{3})\)\s*(?<depart>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})(?:\s*\([^)]+\))?\s*-\s*(?<return>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})(?:\s*\([^)]+\))?.{0,140}?From\s*TWD\s*[\u00a0 ]*(?<price>[\d,]+)'
  )

  $items = New-Object System.Collections.Generic.List[object]
  foreach ($pattern in $patterns) {
    foreach ($match in [regex]::Matches($PlainText, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
      $item = New-FareObject `
        -Airline $Airline `
        -From $match.Groups['from'].Value `
        -To $match.Groups['to'].Value `
        -Depart $match.Groups['depart'].Value `
        -Return $match.Groups['return'].Value `
        -Price $match.Groups['price'].Value `
        -SourceUrl $SourceUrl
      if ($item) { $items.Add($item) }
    }
  }

  return $items
}

function Get-LiveFares {
  $headers = @{
    'User-Agent' = 'Mozilla/5.0 fare-radar-local/1.0'
    'Accept-Language' = 'zh-TW,zh;q=0.9,en;q=0.8'
  }
  $all = New-Object System.Collections.Generic.List[object]
  $errors = New-Object System.Collections.Generic.List[string]
  $seen = @{}

  foreach ($airline in $fareSources.Keys) {
    foreach ($url in $fareSources[$airline]) {
      try {
        $response = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 25
        $plain = ConvertTo-PlainText -Html $response.Content
        $items = Extract-Fares -Airline $airline -PlainText $plain -SourceUrl $url
        foreach ($item in $items) {
          $key = "$($item.airline)|$($item.from)|$($item.to)|$($item.departDate)|$($item.returnDate)|$($item.price)"
          if (-not $seen.ContainsKey($key)) {
            $seen[$key] = $true
            $all.Add($item)
          }
        }
      } catch {
        $errors.Add("$airline $url $($_.Exception.Message)")
      }
    }
  }

  [pscustomobject]@{
    updatedAt = (Get-Date).ToString('o')
    source = 'official-public-fare-pages'
    offers = @($all | Select-Object -First 120)
    errors = @($errors)
  }
}

$listener.Start()
$urlContent = "本機: http://localhost:$Port`n手機: http://${lanIp}:$Port"
Set-Content -LiteralPath (Join-Path $root 'server.url') -Value $urlContent -Encoding UTF8

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = 'index.html'
    }

    try {
      if ($requestPath -eq 'api/live-fares') {
        Send-Json -Response $context.Response -Payload (Get-LiveFares)
      } elseif ($requestPath -eq 'api/search-fares') {
        $qs = $context.Request.QueryString
        $airline  = $qs['airline'];  if (-not $airline)  { $airline  = '' }
        $from     = $qs['from'];     if (-not $from)     { $from     = '' }
        $to       = $qs['to'];       if (-not $to)       { $to       = '' }
        $year     = $qs['year'];     if (-not $year)     { $year     = '' }
        $month    = $qs['month'];    if (-not $month)    { $month    = '' }
        $duration = $qs['duration']; if (-not $duration) { $duration = '' }
        $allFares = Get-LiveFares
        $offers = @($allFares.offers | Where-Object {
          ($airline -eq '' -or $_.airline -eq $airline) -and
          ($from    -eq '' -or $_.from    -eq $from) -and
          ($to      -eq '' -or $_.to      -eq $to) -and
          ($year    -eq '' -or $_.departDate.StartsWith($year)) -and
          ($month   -eq '' -or $_.departDate.Length -ge 7 -and $_.departDate.Substring(5,2) -eq $month) -and
          ($duration -eq '' -or ([Math]::Abs(([datetime]$_.returnDate - [datetime]$_.departDate).Days - [int]$duration) -le 1))
        })
        Send-Json -Response $context.Response -Payload @{
          offers = $offers; totalFetched = $offers.Count
          pagesSearched = 0; errors = @()
          updatedAt = (Get-Date).ToString('o')
        }
      } else {
        $relativePath = $requestPath.Replace('/', '\')
        $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))

        if (-not $fullPath.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase) -and $fullPath -ne $root) {
          Send-Text -Response $context.Response -StatusCode 403 -Text 'Forbidden'
        } elseif (Test-Path -LiteralPath $fullPath -PathType Container) {
          $indexPath = Join-Path $fullPath 'index.html'
          if (Test-Path -LiteralPath $indexPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($indexPath)
            $context.Response.StatusCode = 200
            $context.Response.ContentType = Get-ContentType -Path $indexPath
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
          } else {
            Send-Text -Response $context.Response -StatusCode 404 -Text 'Not found'
          }
        } elseif (Test-Path -LiteralPath $fullPath -PathType Leaf) {
          $bytes = [System.IO.File]::ReadAllBytes($fullPath)
          $context.Response.StatusCode = 200
          $context.Response.ContentType = Get-ContentType -Path $fullPath
          $context.Response.ContentLength64 = $bytes.Length
          $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
          Send-Text -Response $context.Response -StatusCode 404 -Text 'Not found'
        }
      }
    } catch {
      Send-Text -Response $context.Response -StatusCode 500 -Text $_.Exception.Message
    } finally {
      $context.Response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
