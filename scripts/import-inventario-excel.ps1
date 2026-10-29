param(
  [string]$Source = "data/inventarios/ORGANIGRANA BODEGAS.xlsx",
  [string]$Output = "src/modules/inventarios/local/excel-source.json"
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Source))
function Read-Entry([string]$Name) {
  $entry = $archive.GetEntry($Name)
  if (!$entry) { throw "Missing XLSX entry: $Name" }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { $reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
  [xml]$workbook = Read-Entry 'xl/workbook.xml'
  [xml]$relationships = Read-Entry 'xl/_rels/workbook.xml.rels'
  [xml]$shared = Read-Entry 'xl/sharedStrings.xml'
  $strings = @($shared.sst.si | ForEach-Object { $_.InnerText })
  $sheets = @(
    foreach ($sheet in $workbook.workbook.sheets.sheet) {
      $relationId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
      $relation = $relationships.Relationships.Relationship | Where-Object { $_.Id -eq $relationId }
      $target = if ($relation.Target.StartsWith('/')) { $relation.Target.TrimStart('/') } else { 'xl/' + $relation.Target }
      [xml]$xml = Read-Entry $target
      $rows = @(
        foreach ($row in $xml.worksheet.sheetData.row) {
          $cells = [ordered]@{}
          foreach ($cell in $row.c) {
            $value = [string]$cell.v
            if ($cell.t -eq 's') { $value = $strings[[int]$value] }
            elseif ($cell.t -eq 'inlineStr') { $value = $cell.is.InnerText }
            if ($value -ne '') { $cells[($cell.r -replace '\d', '')] = $value }
          }
          # Ignore template months and formulas when there is no category.
          if (([int]$row.r -ge 3 -and $cells['B']) -or ([int]$row.r -ge 3 -and $cells['J']) -or ([int]$row.r -ge 2 -and $cells['Q'])) {
            [ordered]@{ row = [int]$row.r; cells = $cells }
          }
        }
      )
      [ordered]@{ name = [string]$sheet.name; rows = $rows }
    }
  )
  $result = [ordered]@{
    filename = [IO.Path]::GetFileName($Source)
    sha256 = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
    date1904 = ($workbook.workbook.workbookPr.date1904 -in @('1', 'true'))
    sheets = $sheets
  }
  $parent = Split-Path -Parent $Output
  [IO.Directory]::CreateDirectory((Join-Path (Get-Location) $parent)) | Out-Null
  [IO.File]::WriteAllText((Join-Path (Get-Location) $Output), ($result | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
  $sheets | ForEach-Object { Write-Output "$($_.name): $($_.rows.Count) source rows" }
} finally { $archive.Dispose() }
