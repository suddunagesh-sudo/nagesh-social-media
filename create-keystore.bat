@echo off
setlocal
pushd "%~dp0"

where keytool >nul 2>nul
if errorlevel 1 (
    echo keytool nahi mila. JDK install karke PATH configure karein.
    popd
    exit /b 1
)

echo Keystore password aur key password ke liye keytool prompt par apna password type karein.
echo Password is script mein save nahi hota.
keytool -genkeypair -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
if errorlevel 1 (
    echo Keystore create nahi hua.
    popd
    exit /b 1
)

echo Keystore ban gaya: my-release-key.jks
popd
endlocal
