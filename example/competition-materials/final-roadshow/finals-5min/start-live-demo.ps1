$ErrorActionPreference = 'Stop'
$course = Join-Path $PSScriptRoot '现场演示课程'
Set-Location -LiteralPath $course
$portablePython = Join-Path $course '.teach-portable/python.exe'
if (-not (Test-Path -LiteralPath $portablePython)) {
    Write-Host '未找到包内 Python，请先完整解压总决赛材料包。' -ForegroundColor Red
    exit 1
}
& $portablePython -X utf8 -B portable_start.py @args
exit $LASTEXITCODE
