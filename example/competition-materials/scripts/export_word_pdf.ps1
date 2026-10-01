param([Parameter(Mandatory=$true)][string]$InputPath, [Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
$wordApp = $null
$wordDocument = $null
try {
    $wordApp = New-Object -ComObject Word.Application
    $wordApp.Visible = $false
    $wordApp.DisplayAlerts = 0
    $wordApp.AutomationSecurity = 3
    $wordDocument = $wordApp.Documents.Open([IO.Path]::GetFullPath($InputPath), $false, $true, $false)
    $wordDocument.Repaginate()
    $wordDocument.ExportAsFixedFormat([IO.Path]::GetFullPath($OutputPath), 17)
    if (-not (Test-Path -LiteralPath $OutputPath)) { throw 'Word did not produce a PDF' }
} finally {
    if ($wordDocument) { $wordDocument.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordDocument) }
    if ($wordApp) { $wordApp.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApp) }
}
