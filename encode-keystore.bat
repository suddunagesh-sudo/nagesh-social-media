@echo off
setlocal
pushd "%~dp0"

if not exist "my-release-key.jks" (
    echo my-release-key.jks nahi mila. Pehle create-keystore.bat chalayein.
    popd
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$bytes = [IO.File]::ReadAllBytes('my-release-key.jks'); [Convert]::ToBase64String($bytes) | Set-Content -NoNewline -Encoding ASCII 'my-release-key-base64.txt'"
if errorlevel 1 (
    echo Base64 file nahi ban saki.
    popd
    exit /b 1
)

echo Base64 GitHub Secret value my-release-key-base64.txt mein hai.
echo Is file ko private rakhein; GitHub Secret save karne ke baad ise delete karein.
popd
endlocal
