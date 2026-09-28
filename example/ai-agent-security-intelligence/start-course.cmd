@echo off
cd /d "%~dp0"
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if not errorlevel 1 (
  python serve_course.py %*
  goto :done
)
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if not errorlevel 1 (
  py -3 serve_course.py %*
  goto :done
)
echo Python 3.11 or newer is required. Install it and try again.
pause
exit /b 1
:done
if errorlevel 1 (
  echo The course service stopped with an error. Review the message above.
  pause
)
