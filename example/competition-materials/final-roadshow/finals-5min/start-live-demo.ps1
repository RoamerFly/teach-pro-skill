$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '现场演示课程')
$coursePython = Join-Path (Get-Location) '.teach-runtime/Scripts/python.exe'
if (Test-Path -LiteralPath $coursePython) { & $coursePython -X utf8 -B serve_course.py @args; exit $LASTEXITCODE }
$runtimeRoot = Join-Path $env:ProgramFiles 'WindowsApps'
$candidates = Get-ChildItem -LiteralPath $runtimeRoot -Filter 'OpenAI.CodexPrimaryRuntime*' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
foreach ($item in $candidates) {
    $candidatePython = Join-Path $item.FullName 'dependencies/python/python.exe'
    if (Test-Path -LiteralPath $candidatePython) { & $candidatePython -X utf8 -B serve_course.py @args; exit $LASTEXITCODE }
}
& cmd /c start-course.cmd @args
exit $LASTEXITCODE
