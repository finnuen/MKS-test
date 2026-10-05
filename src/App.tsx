import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Moon,
  Copy,
  Check,
  Download,
  Code2,
  Terminal,
  Play,
  Square,
  Music,
  Cpu,
  FileCode2,
  Activity
} from 'lucide-react';
import cppSourceCode from '../main.cpp?raw';
import { buildStandaloneWindowsExe, buildKeyboardIcoBytes, buildKeyboardIcoBase64, NATIVE_WIN32_CSHARP_SOURCE } from './peBuilder';

type TabType = 'keyboard' | 'mouse' | 'speaker';
type SpeakerModeType = 'sweep' | 'fixed' | 'synth';

interface KeyItem {
  code: string;
  vkHex: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const KEYBOARD_LAYOUT: KeyItem[] = [
  // Row 0: Function Row (16 keys) - Main block 0..15u, Nav block 15.5..18.5u
  { code: 'Escape', vkHex: '0x1B', label: 'Esc', x: 0, y: 0, w: 1, h: 1 },
  { code: 'F1', vkHex: '0x70', label: 'F1', x: 2, y: 0, w: 1, h: 1 },
  { code: 'F2', vkHex: '0x71', label: 'F2', x: 3, y: 0, w: 1, h: 1 },
  { code: 'F3', vkHex: '0x72', label: 'F3', x: 4, y: 0, w: 1, h: 1 },
  { code: 'F4', vkHex: '0x73', label: 'F4', x: 5, y: 0, w: 1, h: 1 },
  { code: 'F5', vkHex: '0x74', label: 'F5', x: 6.5, y: 0, w: 1, h: 1 },
  { code: 'F6', vkHex: '0x75', label: 'F6', x: 7.5, y: 0, w: 1, h: 1 },
  { code: 'F7', vkHex: '0x76', label: 'F7', x: 8.5, y: 0, w: 1, h: 1 },
  { code: 'F8', vkHex: '0x77', label: 'F8', x: 9.5, y: 0, w: 1, h: 1 },
  { code: 'F9', vkHex: '0x78', label: 'F9', x: 11, y: 0, w: 1, h: 1 },
  { code: 'F10', vkHex: '0x79', label: 'F10', x: 12, y: 0, w: 1, h: 1 },
  { code: 'F11', vkHex: '0x7A', label: 'F11', x: 13, y: 0, w: 1, h: 1 },
  { code: 'F12', vkHex: '0x7B', label: 'F12', x: 14, y: 0, w: 1, h: 1 },
  { code: 'PrintScreen', vkHex: '0x2C', label: 'PrtSc', x: 15.5, y: 0, w: 1, h: 1 },
  { code: 'ScrollLock', vkHex: '0x91', label: 'ScrLk', x: 16.5, y: 0, w: 1, h: 1 },
  { code: 'Pause', vkHex: '0x13', label: 'Pause', x: 17.5, y: 0, w: 1, h: 1 },

  // Row 1: Number Row + Nav + Numpad (21 keys) - Main 0..15u, Nav 15.5..18.5u, Numpad 19.0..23.0u
  { code: 'Backquote', vkHex: '0xC0', label: '` ~', x: 0, y: 1.25, w: 1, h: 1 },
  { code: 'Digit1', vkHex: '0x31', label: '1', x: 1, y: 1.25, w: 1, h: 1 },
  { code: 'Digit2', vkHex: '0x32', label: '2', x: 2, y: 1.25, w: 1, h: 1 },
  { code: 'Digit3', vkHex: '0x33', label: '3', x: 3, y: 1.25, w: 1, h: 1 },
  { code: 'Digit4', vkHex: '0x34', label: '4', x: 4, y: 1.25, w: 1, h: 1 },
  { code: 'Digit5', vkHex: '0x35', label: '5', x: 5, y: 1.25, w: 1, h: 1 },
  { code: 'Digit6', vkHex: '0x36', label: '6', x: 6, y: 1.25, w: 1, h: 1 },
  { code: 'Digit7', vkHex: '0x37', label: '7', x: 7, y: 1.25, w: 1, h: 1 },
  { code: 'Digit8', vkHex: '0x38', label: '8', x: 8, y: 1.25, w: 1, h: 1 },
  { code: 'Digit9', vkHex: '0x39', label: '9', x: 9, y: 1.25, w: 1, h: 1 },
  { code: 'Digit0', vkHex: '0x30', label: '0', x: 10, y: 1.25, w: 1, h: 1 },
  { code: 'Minus', vkHex: '0xBD', label: '-', x: 11, y: 1.25, w: 1, h: 1 },
  { code: 'Equal', vkHex: '0xBB', label: '=', x: 12, y: 1.25, w: 1, h: 1 },
  { code: 'Backspace', vkHex: '0x08', label: 'Backspace', x: 13, y: 1.25, w: 2, h: 1 },
  { code: 'Insert', vkHex: '0x2D', label: 'Ins', x: 15.5, y: 1.25, w: 1, h: 1 },
  { code: 'Home', vkHex: '0x24', label: 'Home', x: 16.5, y: 1.25, w: 1, h: 1 },
  { code: 'PageUp', vkHex: '0x21', label: 'PgUp', x: 17.5, y: 1.25, w: 1, h: 1 },
  { code: 'NumLock', vkHex: '0x90', label: 'Num', x: 19, y: 1.25, w: 1, h: 1 },
  { code: 'NumpadDivide', vkHex: '0x6F', label: '/', x: 20, y: 1.25, w: 1, h: 1 },
  { code: 'NumpadMultiply', vkHex: '0x6A', label: '*', x: 21, y: 1.25, w: 1, h: 1 },
  { code: 'NumpadSubtract', vkHex: '0x6D', label: '-', x: 22, y: 1.25, w: 1, h: 1 },

  // Row 2: QWERTY Row + Nav + Numpad (21 keys, NumpadAdd spans 2 rows vertically)
  { code: 'Tab', vkHex: '0x09', label: 'Tab', x: 0, y: 2.25, w: 1.5, h: 1 },
  { code: 'KeyQ', vkHex: '0x51', label: 'Q', x: 1.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyW', vkHex: '0x57', label: 'W', x: 2.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyE', vkHex: '0x45', label: 'E', x: 3.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyR', vkHex: '0x52', label: 'R', x: 4.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyT', vkHex: '0x54', label: 'T', x: 5.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyY', vkHex: '0x59', label: 'Y', x: 6.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyU', vkHex: '0x55', label: 'U', x: 7.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyI', vkHex: '0x49', label: 'I', x: 8.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyO', vkHex: '0x4F', label: 'O', x: 9.5, y: 2.25, w: 1, h: 1 },
  { code: 'KeyP', vkHex: '0x50', label: 'P', x: 10.5, y: 2.25, w: 1, h: 1 },
  { code: 'BracketLeft', vkHex: '0xDB', label: '[', x: 11.5, y: 2.25, w: 1, h: 1 },
  { code: 'BracketRight', vkHex: '0xDD', label: ']', x: 12.5, y: 2.25, w: 1, h: 1 },
  { code: 'Backslash', vkHex: '0xDC', label: '\\', x: 13.5, y: 2.25, w: 1.5, h: 1 },
  { code: 'Delete', vkHex: '0x2E', label: 'Del', x: 15.5, y: 2.25, w: 1, h: 1 },
  { code: 'End', vkHex: '0x23', label: 'End', x: 16.5, y: 2.25, w: 1, h: 1 },
  { code: 'PageDown', vkHex: '0x22', label: 'PgDn', x: 17.5, y: 2.25, w: 1, h: 1 },
  { code: 'Numpad7', vkHex: '0x67', label: '7', x: 19, y: 2.25, w: 1, h: 1 },
  { code: 'Numpad8', vkHex: '0x68', label: '8', x: 20, y: 2.25, w: 1, h: 1 },
  { code: 'Numpad9', vkHex: '0x69', label: '9', x: 21, y: 2.25, w: 1, h: 1 },
  { code: 'NumpadAdd', vkHex: '0x6B', label: '+', x: 22, y: 2.25, w: 1, h: 2 },

  // Row 3: ASDF Row + Numpad (16 keys)
  { code: 'CapsLock', vkHex: '0x14', label: 'Caps', x: 0, y: 3.25, w: 1.75, h: 1 },
  { code: 'KeyA', vkHex: '0x41', label: 'A', x: 1.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyS', vkHex: '0x53', label: 'S', x: 2.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyD', vkHex: '0x44', label: 'D', x: 3.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyF', vkHex: '0x46', label: 'F', x: 4.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyG', vkHex: '0x47', label: 'G', x: 5.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyH', vkHex: '0x48', label: 'H', x: 6.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyJ', vkHex: '0x4A', label: 'J', x: 7.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyK', vkHex: '0x4B', label: 'K', x: 8.75, y: 3.25, w: 1, h: 1 },
  { code: 'KeyL', vkHex: '0x4C', label: 'L', x: 9.75, y: 3.25, w: 1, h: 1 },
  { code: 'Semicolon', vkHex: '0xBA', label: ';', x: 10.75, y: 3.25, w: 1, h: 1 },
  { code: 'Quote', vkHex: '0xDE', label: "'", x: 11.75, y: 3.25, w: 1, h: 1 },
  { code: 'Enter', vkHex: '0x0D', label: 'Enter', x: 12.75, y: 3.25, w: 2.25, h: 1 },
  { code: 'Numpad4', vkHex: '0x64', label: '4', x: 19, y: 3.25, w: 1, h: 1 },
  { code: 'Numpad5', vkHex: '0x65', label: '5', x: 20, y: 3.25, w: 1, h: 1 },
  { code: 'Numpad6', vkHex: '0x66', label: '6', x: 21, y: 3.25, w: 1, h: 1 },

  // Row 4: ZXCV Row + Up Arrow + Numpad (17 keys, NumpadEnter spans 2 rows vertically)
  { code: 'ShiftLeft', vkHex: '0xA0', label: 'Shift', x: 0, y: 4.25, w: 2.25, h: 1 },
  { code: 'KeyZ', vkHex: '0x5A', label: 'Z', x: 2.25, y: 4.25, w: 1, h: 1 },
  { code: 'KeyX', vkHex: '0x58', label: 'X', x: 3.25, y: 4.25, w: 1, h: 1 },
  { code: 'KeyC', vkHex: '0x43', label: 'C', x: 4.25, y: 4.25, w: 1, h: 1 },
  { code: 'KeyV', vkHex: '0x56', label: 'V', x: 5.25, y: 4.25, w: 1, h: 1 },
  { code: 'KeyB', vkHex: '0x42', label: 'B', x: 6.25, y: 4.25, w: 1, h: 1 },
  { code: 'KeyN', vkHex: '0x4E', label: 'N', x: 7.25, y: 4.25, w: 1, h: 1 },
  { code: 'KeyM', vkHex: '0x4D', label: 'M', x: 8.25, y: 4.25, w: 1, h: 1 },
  { code: 'Comma', vkHex: '0xBC', label: ',', x: 9.25, y: 4.25, w: 1, h: 1 },
  { code: 'Period', vkHex: '0xBE', label: '.', x: 10.25, y: 4.25, w: 1, h: 1 },
  { code: 'Slash', vkHex: '0xBF', label: '/', x: 11.25, y: 4.25, w: 1, h: 1 },
  { code: 'ShiftRight', vkHex: '0xA1', label: 'RShift', x: 12.25, y: 4.25, w: 2.75, h: 1 },
  { code: 'ArrowUp', vkHex: '0x26', label: 'Up', x: 16.5, y: 4.25, w: 1, h: 1 },
  { code: 'Numpad1', vkHex: '0x61', label: '1', x: 19, y: 4.25, w: 1, h: 1 },
  { code: 'Numpad2', vkHex: '0x62', label: '2', x: 20, y: 4.25, w: 1, h: 1 },
  { code: 'Numpad3', vkHex: '0x63', label: '3', x: 21, y: 4.25, w: 1, h: 1 },
  { code: 'NumpadEnter', vkHex: '0xE8', label: 'Ent', x: 22, y: 4.25, w: 1, h: 2 },

  // Row 5: Bottom Modifiers + Arrows + Numpad (13 keys) -> Total = 104 keys
  { code: 'ControlLeft', vkHex: '0xA2', label: 'Ctrl', x: 0, y: 5.25, w: 1.25, h: 1 },
  { code: 'MetaLeft', vkHex: '0x5B', label: 'Win', x: 1.25, y: 5.25, w: 1.25, h: 1 },
  { code: 'AltLeft', vkHex: '0xA4', label: 'Alt', x: 2.5, y: 5.25, w: 1.25, h: 1 },
  { code: 'Space', vkHex: '0x20', label: 'Space', x: 3.75, y: 5.25, w: 6.25, h: 1 },
  { code: 'AltRight', vkHex: '0xA5', label: 'RAlt', x: 10, y: 5.25, w: 1.25, h: 1 },
  { code: 'MetaRight', vkHex: '0x5C', label: 'RWin', x: 11.25, y: 5.25, w: 1.25, h: 1 },
  { code: 'ContextMenu', vkHex: '0x5D', label: 'Menu', x: 12.5, y: 5.25, w: 1.25, h: 1 },
  { code: 'ControlRight', vkHex: '0xA3', label: 'RCtrl', x: 13.75, y: 5.25, w: 1.25, h: 1 },
  { code: 'ArrowLeft', vkHex: '0x25', label: 'Left', x: 15.5, y: 5.25, w: 1, h: 1 },
  { code: 'ArrowDown', vkHex: '0x28', label: 'Down', x: 16.5, y: 5.25, w: 1, h: 1 },
  { code: 'ArrowRight', vkHex: '0x27', label: 'Right', x: 17.5, y: 5.25, w: 1, h: 1 },
  { code: 'Numpad0', vkHex: '0x60', label: '0', x: 19, y: 5.25, w: 2, h: 1 },
  { code: 'NumpadDecimal', vkHex: '0x6E', label: '.', x: 21, y: 5.25, w: 1, h: 1 },
];

const TOTAL_KEYS = KEYBOARD_LAYOUT.length;

const MSVC_CMD = `cl.exe /O2 /MT /GL /EHsc /DUNICODE /D_UNICODE main.cpp /link /LTCG /OPT:REF /OPT:ICF user32.lib gdi32.lib comctl32.lib comdlg32.lib winmm.lib dwmapi.lib advapi32.lib /SUBSYSTEM:WINDOWS /OUT:MKS-test.exe`;
const MINGW_CMD = `g++ -O3 -flto -s -mwindows -static -DUNICODE -D_UNICODE main.cpp -o MKS-test.exe -luser32 -lgdi32 -lcomctl32 -lcomdlg32 -lwinmm -ldwmapi -ladvapi32`;

const AUTO_BUILD_BAT = `@echo off
setlocal EnableDelayedExpansion
title Building HardwareDiagnostics.exe (Max Performance Native Win32)

echo ============================================================================
echo   Win32 Hardware Diagnostics - 1-Click Native .EXE Builder
echo ============================================================================
echo.

if not exist "main.cpp" (
    echo [ERROR] main.cpp not found in the current folder!
    echo Please place build_exe.bat and main.cpp in the same folder.
    pause
    exit /b 1
)

:: 1. Check if g++ (MinGW-w64) is in PATH
where g++ >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [1/2] Found MinGW-w64 G++ Compiler. Compiling with -O3 -flto -s -static...
    g++ -O3 -flto -s -mwindows -static -DUNICODE -D_UNICODE main.cpp -o HardwareDiagnostics.exe -luser32 -lgdi32 -lcomctl32 -lcomdlg32 -lwinmm -ldwmapi
    if %ERRORLEVEL% EQU 0 (
        echo [2/2] SUCCESS! Built portable HardwareDiagnostics.exe
        start "" "HardwareDiagnostics.exe"
        exit /b 0
    )
)

:: 2. Check if MSVC cl.exe is in PATH or installed via Visual Studio
where cl.exe >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    set "VSWHERE=%ProgramFiles(x86)%\\Microsoft Visual Studio\\Installer\\vswhere.exe"
    if exist "!VSWHERE!" (
        for /f "usebackq tokens=*" %%i in (\`"!VSWHERE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath\`) do (
            if exist "%%i\\VC\\Auxiliary\\Build\\vcvars64.bat" (
                call "%%i\\VC\\Auxiliary\\Build\\vcvars64.bat" >nul
            )
        )
    )
)

where cl.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [1/2] Found MSVC Compiler. Compiling with /O2 /MT /GL /LTCG...
    cl.exe /O2 /MT /GL /EHsc /DUNICODE /D_UNICODE main.cpp /link /LTCG /OPT:REF /OPT:ICF user32.lib gdi32.lib comctl32.lib comdlg32.lib winmm.lib dwmapi.lib /SUBSYSTEM:WINDOWS /OUT:HardwareDiagnostics.exe
    if %ERRORLEVEL% EQU 0 (
        del main.obj >nul 2>nul
        echo [2/2] SUCCESS! Built portable HardwareDiagnostics.exe
        start "" "HardwareDiagnostics.exe"
        exit /b 0
    )
)

echo [INFO] No C++ compiler detected yet. Installing lightweight WinLibs MinGW-w64 via winget...
winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT --accept-package-agreements --accept-source-agreements
echo.
echo Please close and re-run build_exe.bat after installation finishes.
pause
`;

// Generates a single self-contained Windows .bat file that works on 100% of Windows 10/11 PCs
// (Uses g++ or cl.exe if installed, or Windows' built-in C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe with zero downloads!)
function buildSelfExtractingCmd(cppSource: string, csSource: string): string {
  const b64Cpp = btoa(unescape(encodeURIComponent(cppSource)));
  const b64Cs = btoa(unescape(encodeURIComponent(csSource)));
  const b64Ico = buildKeyboardIcoBase64();
  return `@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Building HardwareDiagnostics.exe (Zero-Dependency Native Win32 Builder)
echo ============================================================================
echo   Win32 Hardware Diagnostics - Instant Native .EXE Generator
echo ============================================================================
echo [1/3] Extracting embedded Win32 source and Keyboard Icon (app_keyboard.ico)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$raw = [IO.File]::ReadAllText('%~f0'); $m1 = '::BEGIN_' + 'CPP_B64::'; $m2 = '::BEGIN_' + 'CS_B64::'; $m3 = '::BEGIN_' + 'ICO_B64::'; $i1 = $raw.LastIndexOf($m1); $i2 = $raw.LastIndexOf($m2); $i3 = $raw.LastIndexOf($m3); if ($i1 -ge 0 -and $i2 -gt $i1 -and $i3 -gt $i2) { $cppB64 = $raw.Substring($i1 + $m1.Length, $i2 - ($i1 + $m1.Length)).Trim(); $csB64 = $raw.Substring($i2 + $m2.Length, $i3 - ($i2 + $m2.Length)).Trim(); $icoB64 = $raw.Substring($i3 + $m3.Length).Trim(); [IO.File]::WriteAllBytes('main.cpp', [Convert]::FromBase64String($cppB64)); [IO.File]::WriteAllBytes('HardwareDiagnostics_Win32.cs', [Convert]::FromBase64String($csB64)); [IO.File]::WriteAllBytes('app_keyboard.ico', [Convert]::FromBase64String($icoB64)); }"

:: 1. Try MinGW-w64 G++ if installed
where g++ >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [2/3] Found MinGW-w64 G++. Compiling main.cpp -> HardwareDiagnostics.exe...
    g++ -O3 -flto -s -mwindows -static -DUNICODE -D_UNICODE main.cpp -o HardwareDiagnostics.exe -luser32 -lgdi32 -lcomctl32 -lcomdlg32 -lwinmm -ldwmapi
    if exist "HardwareDiagnostics.exe" (
        del /q "HardwareDiagnostics_Win32.cs" >nul 2>nul
        echo [3/3] SUCCESS! Launching HardwareDiagnostics.exe...
        start "" "HardwareDiagnostics.exe"
        exit /b 0
    )
)

:: 2. Try MSVC cl.exe if installed
where cl.exe >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    set "VSWHERE=%ProgramFiles(x86)%\\Microsoft Visual Studio\\Installer\\vswhere.exe"
    if exist "!VSWHERE!" (
        for /f "usebackq tokens=*" %%i in (\`"!VSWHERE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath\`) do (
            if exist "%%i\\VC\\Auxiliary\\Build\\vcvars64.bat" (
                call "%%i\\VC\\Auxiliary\\Build\\vcvars64.bat" >nul
            )
        )
    )
)
where cl.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [2/3] Found MSVC cl.exe. Compiling main.cpp -> HardwareDiagnostics.exe...
    cl.exe /O2 /MT /GL /EHsc /DUNICODE /D_UNICODE main.cpp /link /LTCG /OPT:REF /OPT:ICF user32.lib gdi32.lib comctl32.lib comdlg32.lib winmm.lib dwmapi.lib /SUBSYSTEM:WINDOWS /OUT:HardwareDiagnostics.exe
    if exist "HardwareDiagnostics.exe" (
        del /q main.obj "HardwareDiagnostics_Win32.cs" >nul 2>nul
        echo [3/3] SUCCESS! Launching HardwareDiagnostics.exe...
        start "" "HardwareDiagnostics.exe"
        exit /b 0
    )
)

:: 3. Use Windows' built-in Native Compiler (Pre-installed on 100% of Windows 10/11 PCs!)
set "CSC64=%SystemRoot%\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
set "CSC32=%SystemRoot%\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"
set "CSC_EXE="
if exist "!CSC64!" set "CSC_EXE=!CSC64!"
if "!CSC_EXE!"=="" if exist "!CSC32!" set "CSC_EXE=!CSC32!"

if not "!CSC_EXE!"=="" (
    echo [2/3] Compiling HardwareDiagnostics.exe with Keyboard Icon using built-in Windows compiler...
    "!CSC_EXE!" /nologo /target:winexe /optimize+ /win32icon:"%~dp0app_keyboard.ico" /out:"%~dp0HardwareDiagnostics.exe" "%~dp0HardwareDiagnostics_Win32.cs"
    del /q "%~dp0HardwareDiagnostics_Win32.cs" >nul 2>nul
    if exist "%~dp0HardwareDiagnostics.exe" (
        echo [3/3] SUCCESS! Built HardwareDiagnostics.exe in %~dp0
        start "" "%~dp0HardwareDiagnostics.exe"
        exit /b 0
    )
)

echo [ERROR] Could not build HardwareDiagnostics.exe.
pause
exit /b 1
::BEGIN_CPP_B64::
${b64Cpp}
::BEGIN_CS_B64::
${b64Cs}
::BEGIN_ICO_B64::
${b64Ico}
`;
}

const MELODY_NOTES_HZ = [
  261.63, 329.63, 392.0, 523.25,
  293.66, 369.99, 440.0, 587.33,
  329.63, 415.3, 493.88, 659.25,
  261.63, 392.0, 523.25, 392.0,
];

interface MouseButtonStats {
  name: string;
  clicks: number;
  faults: number;
  lastDeltaMs: number | null;
  lastTime: number | null;
  down: boolean;
}

interface ScrollGraphSample {
  id: number;
  stepDir: 1 | -1;
  state: 'normal' | 'analyzing' | 'error';
}

const STORAGE_KEY = 'appdata_hardware_diagnostics_settings_v1_0';

const ARCHITECTURE_FINDINGS = [
  {
    area: '01. Zero-Allocation GDI Rendering Pipeline',
    before: 'Created & destroyed 4 HFONT objects, compatible DC/Bitmap, and >220 HBRUSH/HPEN handles on every WM_PAINT frame.',
    after: 'Persistent DPI-aware HFONT cache + reusable off-screen HDC/HBITMAP backbuffer + GetStockObject(DC_BRUSH / DC_PEN) & ExtTextOutW fast fills.',
    gain: '0 GDI allocations per frame',
  },
  {
    area: '02. O(1) Fixed Ring Buffers in Input Paths',
    before: 'Used std::vector::insert(begin()) and erase(begin()) on every scroll notch and click, causing heap reallocations and O(N) shifts.',
    after: 'Fixed-capacity circular ring buffers (ScrollGraphPoint[128] & MouseLogEntry[8]) with head/count indices in static memory.',
    gain: 'O(1) constant-time telemetry',
  },
  {
    area: '03. Deadlock-Free WaveOut PCM Audio Engine',
    before: 'Called waveOutWrite directly inside WaveOutProc (CALLBACK_FUNCTION), risking Windows multimedia mixer deadlocks and zipper clicks.',
    after: 'Dispatches MM_WOM_DONE via CALLBACK_WINDOW to WndProc with static stereo PCM buffers and single-pole exponential gain/frequency smoothing.',
    gain: 'Click-free 44.1 kHz stereo PCM',
  },
  {
    area: '04. Scan-Code Disambiguation & NKRO Rollover',
    before: 'Mapped Numpad Enter and Main Enter to the same VK_RETURN slot; no virtual key mouse testing or simultaneous rollover tracking.',
    after: 'Disambiguates LLKHF_EXTENDED Numpad Enter (0xE8) & L/R modifiers in WH_KEYBOARD_LL, tracks live/peak NKRO, and supports virtual key clicks.',
    gain: 'Full 104-key hardware accuracy',
  },
];

export default function App() {
  const loadInitialSettings = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  };

  const saved = loadInitialSettings();

  const [activeTab, setActiveTab] = useState<TabType>(saved?.activeTab ?? 'mouse');
  const [darkMode, setDarkMode] = useState<boolean>(saved?.darkMode ?? true);
  const [showCppPanel, setShowCppPanel] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Keyboard state
  const [keysDown, setKeysDown] = useState<Record<string, boolean>>({});
  const [keysLatched, setKeysLatched] = useState<Record<string, boolean>>({});
  const [keyboardDisabled, setKeyboardDisabled] = useState<boolean>(false);
  const [blockShortcuts, setBlockShortcuts] = useState<boolean>(saved?.blockShortcuts ?? true);
  const [lastKeyInfo, setLastKeyInfo] = useState<{ code: string; key: string; vkHex: string } | null>(null);
  const [totalKeyPresses, setTotalKeyPresses] = useState<number>(0);
  const [peakRollover, setPeakRollover] = useState<number>(0);

  // Mouse state
  const [mouseDisabled, setMouseDisabled] = useState<boolean>(false);
  const [mouseButtons, setMouseButtons] = useState<MouseButtonStats[]>([
    { name: 'Left Button', clicks: 0, faults: 0, lastDeltaMs: null, lastTime: null, down: false },
    { name: 'Middle Wheel Click', clicks: 0, faults: 0, lastDeltaMs: null, lastTime: null, down: false },
    { name: 'Right Button', clicks: 0, faults: 0, lastDeltaMs: null, lastTime: null, down: false },
    { name: 'Side Back (X1)', clicks: 0, faults: 0, lastDeltaMs: null, lastTime: null, down: false },
    { name: 'Side Forward (X2)', clicks: 0, faults: 0, lastDeltaMs: null, lastTime: null, down: false },
  ]);
  const [scrollUpCount, setScrollUpCount] = useState<number>(0);
  const [scrollDownCount, setScrollDownCount] = useState<number>(0);
  const [scrollCumulative, setScrollCumulative] = useState<number>(0);
  const [scrollGlitches, setScrollGlitches] = useState<number>(0);
  const [scrollGraph, setScrollGraph] = useState<ScrollGraphSample[]>([]);
  const [mouseLogs, setMouseLogs] = useState<{ id: number; text: string; fault: boolean }[]>([]);
  const lastScrollMeta = useRef<{ dir: 'UP' | 'DOWN' | null; time: number }>({ dir: null, time: 0 });

  // Speaker Audio state
  const [speakerPlaying, setSpeakerPlaying] = useState<boolean>(false);
  const [speakerMode, setSpeakerMode] = useState<SpeakerModeType>(
    saved?.speakerMode === 'custom' ? 'synth' : (saved?.speakerMode ?? 'sweep')
  );
  const [frequencyHz, setFrequencyHz] = useState<number>(saved?.fixedFreqHz ?? 440);
  const [fixedFreqHz, setFixedFreqHz] = useState<number>(saved?.fixedFreqHz ?? 440);
  const [balance, setBalance] = useState<number>(saved?.balance ?? 0);
  const [volume, setVolume] = useState<number>(saved?.volume ?? 0.01);

  // Detected Device Names for [Mouse | Keyboard | Speaker]
  const [mouseDeviceName, setMouseDeviceName] = useState<string>('HID-Compliant Mouse');
  const [keyboardDeviceName, setKeyboardDeviceName] = useState<string>('Standard PS/2 or HID Keyboard');
  const [speakerDeviceName, setSpeakerDeviceName] = useState<string>('Default Windows Audio Output');

  useEffect(() => {
    const detectDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOut = devices.find((d) => d.kind === 'audiooutput' && d.label);
          if (audioOut && audioOut.label) {
            setSpeakerDeviceName(audioOut.label);
          }
        }
      } catch {}

      try {
        const navAny = navigator as any;
        if (navAny.hid && typeof navAny.hid.getDevices === 'function') {
          const hidDevs = await navAny.hid.getDevices();
          if (Array.isArray(hidDevs)) {
            for (const dev of hidDevs) {
              if (dev?.productName && Array.isArray(dev.collections)) {
                for (const col of dev.collections) {
                  if (col.usagePage === 0x01 && col.usage === 0x02) {
                    setMouseDeviceName(dev.productName);
                  } else if (col.usagePage === 0x01 && col.usage === 0x06) {
                    setKeyboardDeviceName(dev.productName);
                  }
                }
              }
            }
          }
        }
      } catch {}
    };

    detectDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', detectDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', detectDevices);
    };
  }, []);

  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sweepAnimRef = useRef<number | null>(null);
  const sweepProgressRef = useRef<number>(0);
  const synthStartRef = useRef<number>(0);
  const spaceUnlockRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: 0 });

  // Persist settings automatically
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeTab,
          darkMode,
          blockShortcuts,
          speakerMode,
          fixedFreqHz,
          balance,
          volume,
        })
      );
    } catch {}
  }, [activeTab, darkMode, blockShortcuts, speakerMode, fixedFreqHz, balance, volume]);

  // Keyboard listener
  useEffect(() => {
    const resolveLayoutKey = (e: KeyboardEvent) => {
      if (e.code) {
        const aliasMap: Record<string, string> = {
          OSLeft: 'MetaLeft',
          OSRight: 'MetaRight',
          IntlBackslash: 'Backslash',
          IntlRo: 'Slash',
          IntlYen: 'Backslash',
        };
        const codeToCheck = aliasMap[e.code] || e.code;
        const byCode = KEYBOARD_LAYOUT.find((item) => item.code === codeToCheck);
        if (byCode) return byCode;
      }

      const kc = e.keyCode || e.which || 0;
      if (kc > 0) {
        if (kc === 13 && e.location === 3) {
          return KEYBOARD_LAYOUT.find((item) => item.code === 'NumpadEnter') || null;
        }
        if (kc === 16) {
          return KEYBOARD_LAYOUT.find((item) => item.code === (e.location === 2 ? 'ShiftRight' : 'ShiftLeft')) || null;
        }
        if (kc === 17) {
          return KEYBOARD_LAYOUT.find((item) => item.code === (e.location === 2 ? 'ControlRight' : 'ControlLeft')) || null;
        }
        if (kc === 18) {
          return KEYBOARD_LAYOUT.find((item) => item.code === (e.location === 2 ? 'AltRight' : 'AltLeft')) || null;
        }
        const hex = `0x${kc.toString(16).toUpperCase().padStart(2, '0')}`;
        const byVk = KEYBOARD_LAYOUT.find((item) => item.vkHex.toUpperCase() === hex);
        if (byVk) return byVk;
      }

      if (e.key && e.key !== 'Unidentified' && e.key !== 'Process') {
        const upper = e.key === ' ' ? 'SPACE' : e.key.toUpperCase();
        const byLabel = KEYBOARD_LAYOUT.find((item) => item.label.toUpperCase() === upper);
        if (byLabel) return byLabel;
      }

      return null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const matched = resolveLayoutKey(e);
      const effectiveCode = matched ? matched.code : e.code || e.key;

      // Shortcut: Press Space 5 times to enable mouse and keyboard
      if (effectiveCode === 'Space' || e.key === ' ') {
        if (!e.repeat) {
          const now = performance.now();
          if (now - spaceUnlockRef.current.lastTime > 2500) {
            spaceUnlockRef.current.count = 1;
          } else {
            spaceUnlockRef.current.count += 1;
          }
          spaceUnlockRef.current.lastTime = now;

          if (spaceUnlockRef.current.count >= 5 && (keyboardDisabled || mouseDisabled)) {
            e.preventDefault();
            e.stopPropagation();
            setKeyboardDisabled(false);
            setMouseDisabled(false);
            spaceUnlockRef.current.count = 0;
            return;
          }
        }
      } else {
        spaceUnlockRef.current.count = 0;
      }

      if (keyboardDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (activeTab === 'keyboard' && !showCppPanel && effectiveCode) {
        if (blockShortcuts) {
          e.preventDefault();
          e.stopPropagation();
        }
        setKeysDown((prev) => {
          if (!prev[effectiveCode]) {
            setTotalKeyPresses((c) => c + 1);
          }
          const next = { ...prev, [effectiveCode]: true };
          const held = Object.values(next).filter(Boolean).length;
          setPeakRollover((pk) => Math.max(pk, held));
          return next;
        });
        setKeysLatched((prev) => ({ ...prev, [effectiveCode]: true }));
        setLastKeyInfo({
          code: effectiveCode,
          key: matched ? matched.label : e.key === ' ' ? 'Space' : e.key,
          vkHex: matched ? matched.vkHex : '0x00',
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keyboardDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (activeTab === 'keyboard' && !showCppPanel) {
        const matched = resolveLayoutKey(e);
        const effectiveCode = matched ? matched.code : e.code || e.key;
        if (blockShortcuts) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (effectiveCode) {
          setKeysDown((prev) => ({ ...prev, [effectiveCode]: false }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [activeTab, keyboardDisabled, mouseDisabled, blockShortcuts, showCppPanel]);

  useEffect(() => {
    if (activeTab === 'keyboard' && !showCppPanel) {
      try {
        window.focus();
        rootContainerRef.current?.focus({ preventScroll: true });
      } catch {}
    }
  }, [activeTab, showCppPanel]);

  const handleResetKeyboard = () => {
    setKeysDown({});
    setKeysLatched({});
    setTotalKeyPresses(0);
    setPeakRollover(0);
    setLastKeyInfo(null);
  };

  // Mouse Click Arena Handler
  const handleArenaMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mouseDisabled) return;
    const btnIdx = e.button;
    if (btnIdx < 0 || btnIdx > 4) return;
    const now = performance.now();

    setMouseButtons((prev) =>
      prev.map((b, idx) => {
        if (idx !== btnIdx) return b;
        const delta = b.lastTime !== null ? now - b.lastTime : null;
        const isFault = delta !== null && delta < 80.0;
        const logMsg =
          delta === null
            ? `[OK] ${b.name} initial click registered`
            : isFault
            ? `[FAULT] ${b.name} switch bounce detected: ${delta.toFixed(1)} ms (< 80 ms)`
            : `[OK] ${b.name} interval: ${delta.toFixed(1)} ms`;

        setMouseLogs((logs) => [{ id: Date.now() + Math.random(), text: logMsg, fault: isFault }, ...logs.slice(0, 7)]);

        return {
          ...b,
          clicks: b.clicks + 1,
          faults: isFault ? b.faults + 1 : b.faults,
          lastDeltaMs: delta,
          lastTime: now,
          down: true,
        };
      })
    );
  };

  const handleArenaMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mouseDisabled) return;
    const btnIdx = e.button;
    setMouseButtons((prev) => prev.map((b, idx) => (idx === btnIdx ? { ...b, down: false } : b)));
  };

  const handleArenaWheel = (e: React.WheelEvent) => {
    if (mouseDisabled) return;
    const now = performance.now();
    const dir: 'UP' | 'DOWN' = e.deltaY < 0 ? 'UP' : 'DOWN';
    let isGlitch = false;

    if (
      lastScrollMeta.current.dir !== null &&
      lastScrollMeta.current.dir !== dir &&
      now - lastScrollMeta.current.time < 55.0
    ) {
      isGlitch = true;
      const dt = now - lastScrollMeta.current.time;
      setScrollGlitches((g) => g + 1);
      setMouseLogs((logs) => [
        {
          id: Date.now() + Math.random(),
          text: `[ENCODER GLITCH] Reverse jump (${dir}) within ${dt.toFixed(1)} ms`,
          fault: true,
        },
        ...logs.slice(0, 7),
      ]);
    }

    lastScrollMeta.current = { dir, time: now };

    const stepDir: 1 | -1 = dir === 'UP' ? 1 : -1;
    if (dir === 'UP') setScrollUpCount((c) => c + 1);
    else setScrollDownCount((c) => c + 1);

    setScrollCumulative((prevCum) => prevCum + stepDir);
    const sampleId = Date.now() + Math.random();
    const initialState: 'normal' | 'analyzing' | 'error' = isGlitch ? 'error' : 'analyzing';

    setScrollGraph((prevGraph) => [...prevGraph.slice(-75), { id: sampleId, stepDir, state: initialState }]);

    if (!isGlitch) {
      setTimeout(() => {
        setScrollGraph((prevGraph) =>
          prevGraph.map((item) => (item.id === sampleId && item.state === 'analyzing' ? { ...item, state: 'normal' } : item))
        );
      }, 160);
    }
  };

  const handleResetMouse = () => {
    setMouseButtons((prev) =>
      prev.map((b) => ({ ...b, clicks: 0, faults: 0, lastDeltaMs: null, lastTime: null, down: false }))
    );
    setScrollUpCount(0);
    setScrollDownCount(0);
    setScrollCumulative(0);
    setScrollGlitches(0);
    setScrollGraph([]);
    setMouseLogs([]);
  };

  // Audio Synthesis & Custom Music Engine
  const stopAudio = useCallback(() => {
    if (sweepAnimRef.current) {
      cancelAnimationFrame(sweepAnimRef.current);
      sweepAnimRef.current = null;
    }
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {}
      oscRef.current = null;
    }
    setSpeakerPlaying(false);
  }, []);

  const startAudio = useCallback(
    (modeOverride?: SpeakerModeType) => {
      const targetMode = modeOverride ?? speakerMode;
      stopAudio();
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const panner = ctx.createStereoPanner();
      const gain = ctx.createGain();
      panner.pan.value = balance;
      gain.gain.value = volume * 0.45;
      panner.connect(gain);
      gain.connect(ctx.destination);

      pannerRef.current = panner;
      gainRef.current = gain;

      const osc = ctx.createOscillator();
      osc.type = targetMode === 'synth' ? 'triangle' : 'sine';
      osc.frequency.value = targetMode === 'fixed' ? fixedFreqHz : frequencyHz;
      osc.connect(panner);
      osc.start();
      oscRef.current = osc;
      synthStartRef.current = performance.now();

      setSpeakerPlaying(true);
    },
    [balance, fixedFreqHz, frequencyHz, speakerMode, stopAudio, volume]
  );

  useEffect(() => {
    if (!speakerPlaying) return;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      if (speakerMode === 'sweep') {
        sweepProgressRef.current = (sweepProgressRef.current + dt / 8.0) % 1.0;
        const nextFreq = 20 * Math.pow(20000 / 20, sweepProgressRef.current);
        setFrequencyHz(nextFreq);
        if (oscRef.current && audioCtxRef.current) {
          oscRef.current.frequency.setTargetAtTime(nextFreq, audioCtxRef.current.currentTime, 0.015);
        }
      } else if (speakerMode === 'synth') {
        const elapsed = (now - synthStartRef.current) / 1000;
        const step = Math.floor(elapsed * 5.0) % 16;
        const noteHz = MELODY_NOTES_HZ[step];
        setFrequencyHz(noteHz);
        if (oscRef.current && audioCtxRef.current) {
          oscRef.current.frequency.setTargetAtTime(noteHz, audioCtxRef.current.currentTime, 0.01);
        }
      }
      sweepAnimRef.current = requestAnimationFrame(tick);
    };

    sweepAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (sweepAnimRef.current) cancelAnimationFrame(sweepAnimRef.current);
    };
  }, [speakerPlaying, speakerMode]);

  useEffect(() => {
    if (oscRef.current && audioCtxRef.current && speakerMode === 'fixed') {
      oscRef.current.frequency.setTargetAtTime(fixedFreqHz, audioCtxRef.current.currentTime, 0.012);
    }
  }, [fixedFreqHz, speakerMode]);

  useEffect(() => {
    if (pannerRef.current && audioCtxRef.current) {
      pannerRef.current.pan.setTargetAtTime(balance, audioCtxRef.current.currentTime, 0.012);
    }
  }, [balance]);

  useEffect(() => {
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setTargetAtTime(volume * 0.45, audioCtxRef.current.currentTime, 0.012);
    }
  }, [volume]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCompiledExe = () => {
    const exeBytes = buildStandaloneWindowsExe();
    const blob = new Blob([exeBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MKS-test.exe';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadKeyboardIco = () => {
    const icoBytes = buildKeyboardIcoBytes();
    const blob = new Blob([icoBytes.buffer as ArrayBuffer], { type: 'image/x-icon' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app_keyboard.ico';
    a.click();
    URL.revokeObjectURL(url);
  };

  const latchedCount = Object.values(keysLatched).filter(Boolean).length;
  const currentRollover = Object.values(keysDown).filter(Boolean).length;
  const totalMouseFaults = mouseButtons.reduce((acc, b) => acc + b.faults, 0);

  const renderScrollGraphSvg = () => {
    const width = 620;
    const height = 148;
    const padX = 14;
    const midY = height / 2;
    const barHalfH = 52;
    const maxBars = 76;
    const slotW = (width - padX * 2) / maxBars;
    const barW = Math.max(3.5, slotW - 2.5);

    return (
      <div className="h-36 w-full relative flex items-center justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <line
            x1={padX}
            y1={midY}
            x2={width - padX}
            y2={midY}
            stroke={darkMode ? '#334155' : '#94a3b8'}
            strokeWidth="1.5"
          />
          {scrollGraph.map((pt, idx) => {
            const x = padX + idx * slotW;
            const y = pt.stepDir > 0 ? midY - barHalfH : midY + 1;
            const fill =
              pt.state === 'error'
                ? '#dc2626'
                : pt.state === 'analyzing'
                ? '#d97706'
                : pt.stepDir > 0
                ? '#22c55e'
                : '#2563eb';
            return (
              <rect
                key={pt.id}
                x={x}
                y={y}
                width={barW}
                height={barHalfH - 1}
                rx={1.5}
                fill={fill}
              />
            );
          })}
        </svg>
        {scrollGraph.length === 0 && (
          <span className="absolute text-xs font-mono text-slate-500 pointer-events-none">
            Scroll mouse wheel up or down to plot encoder bars...
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={rootContainerRef}
      tabIndex={-1}
      onMouseDown={() => {
        if (activeTab === 'keyboard' && !showCppPanel) {
          try {
            window.focus();
            rootContainerRef.current?.focus({ preventScroll: true });
          } catch {}
        }
      }}
      className={`min-h-screen outline-none transition-colors duration-150 ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar Contract: Zone 1 Brand | Zone 2 Segmented [Mouse | Keyboard | Speaker] + Device Name | Zone 3 Actions */}
      <header
        className={`flex items-center justify-between px-6 py-3 border-b ${
          darkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white'
        }`}
      >
        <span className="text-base font-semibold tracking-tight whitespace-nowrap flex items-center gap-2">
          <span>MKS-test</span>
          <span className="text-xs font-mono text-sky-400">v1.0</span>
        </span>

        <div className="flex flex-col items-center gap-1">
          <nav
            aria-label="Diagnostic Modules"
            className={`flex items-center p-1 rounded-lg border ${
              darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}
          >
            {(['mouse', 'keyboard', 'speaker'] as TabType[]).map((tab) => {
              const isActive = activeTab === tab && !showCppPanel;
              const label = tab.charAt(0).toUpperCase() + tab.slice(1);
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setShowCppPanel(false);
                  }}
                  className={`px-6 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 font-semibold shadow-xs'
                      : darkMode
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
          <span
            className={`text-xs font-mono tracking-tight truncate max-w-[420px] ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
            title={
              activeTab === 'mouse'
                ? mouseDeviceName
                : activeTab === 'keyboard'
                ? keyboardDeviceName
                : speakerDeviceName
            }
          >
            {activeTab === 'mouse'
              ? mouseDeviceName
              : activeTab === 'keyboard'
              ? keyboardDeviceName
              : speakerDeviceName}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={downloadCompiledExe}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MKS-test.exe</span>
          </button>

          <button
            onClick={() => setShowCppPanel((v) => !v)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              showCppPanel
                ? 'bg-sky-500 text-slate-950 border-sky-500 font-semibold'
                : darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showCppPanel ? 'Back to Live Simulator' : 'C++ Source & .EXE Options'}</span>
          </button>

          <button
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle Dark Mode"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
            }`}
          >
            {darkMode ? <Moon className="w-3.5 h-3.5 text-sky-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
            <span>{darkMode ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1380px] mx-auto px-6 py-6">
        {showCppPanel ? (
          /* =====================================================================
             C++ ARCHITECTURE ANALYSIS & 1-CLICK STANDALONE .EXE BUILDER
             ===================================================================== */
          <div className="space-y-6">
            {/* Primary Builder Action Card */}
            <div
              className={`p-6 rounded-xl border ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-800/60">
                <div className="max-w-2xl">
                  <h1 className="text-xl font-semibold tracking-tight">
                    Standalone Native Win32 C++ Executable (<code className="font-mono">MKS-test.exe</code>)
                  </h1>
                  <p className={`text-sm mt-1.5 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Download the ready-to-run <code className="font-mono">MKS-test.exe</code> binary directly, use the zero-install builder, or grab <code className="font-mono">main.cpp</code>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={downloadCompiledExe}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Ready-to-Run MKS-test.exe</span>
                  </button>

                  <button
                    onClick={() => {
                      const selfExtracting = buildSelfExtractingCmd(cppSourceCode, NATIVE_WIN32_CSHARP_SOURCE);
                      downloadFile('Make_HardwareDiagnostics_EXE.bat', selfExtracting);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Cpu className="w-4 h-4" />
                    <span>Zero-Install .EXE Builder (Make_HardwareDiagnostics_EXE.bat)</span>
                  </button>

                  <button
                    onClick={() => downloadFile('main.cpp', cppSourceCode)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                        : 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <FileCode2 className="w-4 h-4" />
                    <span>Download main.cpp</span>
                  </button>

                  <button
                    onClick={downloadKeyboardIco}
                    className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                        : 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <Download className="w-4 h-4 text-sky-400" />
                    <span>app_keyboard.ico</span>
                  </button>
                </div>
              </div>

              {/* Engineering Audit & Win32 Data Handling Optimizations */}
              <div className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-400" />
                    <span>Win32 API & Data-Handling Architecture Audit</span>
                  </h2>
                  <span className={`text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Zero external DLLs · Win32 GDI + Hooks + WinMM + INI Persistence
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {ARCHITECTURE_FINDINGS.map((item) => (
                    <div
                      key={item.area}
                      className={`p-4 rounded-lg border ${
                        darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-sky-400">{item.area}</span>
                        <span className="text-xs font-mono text-emerald-400">{item.gain}</span>
                      </div>
                      <p className={`text-xs leading-relaxed mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        <strong className={darkMode ? 'text-slate-300' : 'text-slate-800'}>Baseline Issue:</strong> {item.before}
                      </p>
                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <strong className="text-emerald-400">Win32 Solution:</strong> {item.after}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual Command-Line Build Recipes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-5">
                <div
                  className={`p-4 rounded-lg border ${
                    darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      MSVC (Maximum Speed + Whole-Program LTCG + Static CRT)
                    </span>
                    <button
                      onClick={() => copyText('msvc', MSVC_CMD)}
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === 'msvc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === 'msvc' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono overflow-x-auto p-2.5 rounded bg-black/30 text-sky-300">
                    {MSVC_CMD}
                  </pre>
                </div>

                <div
                  className={`p-4 rounded-lg border ${
                    darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      MinGW-w64 G++ (-O3 -flto -s -static · Smallest Portable .EXE)
                    </span>
                    <button
                      onClick={() => copyText('mingw', MINGW_CMD)}
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === 'mingw' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === 'mingw' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono overflow-x-auto p-2.5 rounded bg-black/30 text-emerald-300">
                    {MINGW_CMD}
                  </pre>
                </div>
              </div>
            </div>

            {/* Full Source Code Viewer */}
            <div
              className={`rounded-xl border overflow-hidden ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div
                className={`px-5 py-3 border-b flex items-center justify-between text-xs font-mono ${
                  darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-sky-400" />
                  <span>main.cpp · Pure Standalone Win32 C++ Application (Zero Dependencies)</span>
                </span>
                <span>{cppSourceCode.split('\n').length} lines</span>
              </div>
              <pre className="p-5 text-xs font-mono leading-relaxed overflow-x-auto max-h-[580px]">
                {cppSourceCode}
              </pre>
            </div>
          </div>
        ) : activeTab === 'keyboard' ? (
          /* =====================================================================
             TAB 1: KEYBOARD DIAGNOSTIC MODULE
             ===================================================================== */
          <div className="space-y-5">
            <div
              className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setKeyboardDisabled((d) => !d)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    keyboardDisabled
                      ? 'bg-red-600 text-white border-red-500'
                      : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {keyboardDisabled ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>
                    {keyboardDisabled
                      ? 'Keyboard Disabled (Click to Re-enable)'
                      : 'Disable Keyboard (Clean Without Unplugging)'}
                  </span>
                </button>

                <button
                  onClick={() => setBlockShortcuts((b) => !b)}
                  className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    blockShortcuts
                      ? 'bg-sky-500/15 border-sky-500/50 text-sky-400'
                      : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  Windows Shortcuts: {blockShortcuts ? 'Intercepted & Blocked' : 'Allowed'}
                </button>

                <button
                  onClick={handleResetKeyboard}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Lit Keys</span>
                </button>
              </div>

              <div
                className={`flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums ${
                  darkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                <span>
                  Lit Keys: <strong className="text-emerald-400">{latchedCount}</strong> / {TOTAL_KEYS}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  NKRO Held: <strong className="text-sky-400">{currentRollover}</strong> (Peak: {peakRollover})
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Keystrokes: <strong className="text-sky-400">{totalKeyPresses}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Last Key:{' '}
                  <strong className={darkMode ? 'text-slate-100' : 'text-slate-900'}>
                    {lastKeyInfo ? `${lastKeyInfo.key} (${lastKeyInfo.vkHex})` : 'None'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Full 104-Key Visual Layout (Static Responsive 23.0u x 6.25u Grid - Zero Overflow) */}
            <div
              className={`p-5 rounded-xl border overflow-hidden ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="w-full select-none overflow-hidden">
                <div className="relative w-full h-[310px]">
                  {KEYBOARD_LAYOUT.map((k) => {
                    const isDown = !!keysDown[k.code];
                    const isLatched = !!keysLatched[k.code];
                    const leftPct = (k.x / 23) * 100;
                    const topPct = (k.y / 6.25) * 100;
                    const widthPct = (k.w / 23) * 100;
                    const heightPct = (k.h / 6.25) * 100;

                    return (
                      <div
                        key={k.code}
                        style={{
                          left: `calc(${leftPct}% + 2px)`,
                          top: `calc(${topPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          height: `calc(${heightPct}% - 4px)`,
                        }}
                        className={`absolute rounded-md border flex items-center justify-center px-0.5 text-[11px] font-semibold overflow-hidden truncate transition-colors duration-75 pointer-events-none select-none ${
                          isDown
                            ? 'bg-sky-400 text-slate-950 border-sky-300'
                            : isLatched
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : darkMode
                            ? 'bg-slate-800/90 border-slate-700 text-slate-200'
                            : 'bg-slate-100 border-slate-300 text-slate-800'
                        }`}
                      >
                        <span className="truncate">{k.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className={`mt-4 pt-3.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs overflow-hidden ${
                  darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                <span className="truncate">
                  Press any physical key on your keyboard. Tested keys stay lit green until reset.
                </span>
                <span className="font-mono truncate">
                  Settings persisted to: %APPDATA%\HardwareDiagnostics\settings.ini
                </span>
              </div>
            </div>
          </div>
        ) : activeTab === 'mouse' ? (
          /* =====================================================================
             TAB 2: MOUSE DIAGNOSTIC MODULE (WITH SCROLL PROGRESSING GRAPH)
             ===================================================================== */
          <div className="space-y-5">
            <div
              className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setMouseDisabled((d) => !d)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    mouseDisabled
                      ? 'bg-red-600 text-white border-red-500'
                      : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {mouseDisabled ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>
                    {mouseDisabled
                      ? 'MOUSE DISABLED · Press Space 5x to Enable'
                      : 'Disable Mouse (Clean Mode)'}
                  </span>
                </button>

                <button
                  onClick={handleResetMouse}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Mouse Counters</span>
                </button>
              </div>

              <div
                className={`flex items-center gap-3 text-xs font-mono tabular-nums ${
                  darkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                <span>
                  Double-Click Faults (&lt;80ms):{' '}
                  <strong className={totalMouseFaults > 0 ? 'text-red-500' : 'text-emerald-400'}>
                    {totalMouseFaults}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Scroll Up/Down: <strong className="text-sky-400">{scrollUpCount}</strong> /{' '}
                  <strong className="text-sky-400">{scrollDownCount}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Encoder Glitches:{' '}
                  <strong className={scrollGlitches > 0 ? 'text-red-500' : 'text-emerald-400'}>{scrollGlitches}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left Column: Double-Click Test Arena & Switch Matrix */}
              <div
                className={`p-6 rounded-xl border space-y-4 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">01. Double-Click Switch Bounce Detector</h2>
                  <span className={`text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Fault Threshold: 80.0 ms
                  </span>
                </div>

                <div
                  onMouseDown={handleArenaMouseDown}
                  onMouseUp={handleArenaMouseUp}
                  onContextMenu={(e) => e.preventDefault()}
                  onWheel={handleArenaWheel}
                  className={`h-36 rounded-xl border-2 flex flex-col items-center justify-center select-none cursor-pointer transition-colors ${
                    mouseDisabled
                      ? 'border-red-500/60 bg-red-950/20 text-red-400'
                      : totalMouseFaults > 0
                      ? 'border-red-500 bg-red-500/10'
                      : darkMode
                      ? 'border-sky-500/60 bg-slate-950 hover:bg-slate-800/60'
                      : 'border-sky-500 bg-slate-100 hover:bg-slate-200/70'
                  }`}
                >
                  <p className="text-sm font-semibold">
                    {mouseDisabled
                      ? 'MOUSE INPUT LOCKED FOR CLEANING · PRESS SPACE 5 TIMES TO UNLOCK'
                      : 'CLICK OR SCROLL HERE (Left / Middle / Right / Side Buttons)'}
                  </p>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Measures QPC microsecond switch intervals to detect faulty mechanical chatter.
                  </p>
                </div>

                <div className="space-y-2">
                  {mouseButtons.map((btn) => (
                    <div
                      key={btn.name}
                      className={`px-4 py-2.5 rounded-lg border flex items-center justify-between gap-2 overflow-hidden text-xs font-mono tabular-nums ${
                        btn.faults > 0
                          ? 'border-red-500/70 bg-red-500/10'
                          : btn.down
                          ? 'border-sky-400 bg-sky-500/15'
                          : darkMode
                          ? 'border-slate-800 bg-slate-950/60'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <span className="font-sans font-medium truncate">{btn.name}</span>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span>Clicks: {btn.clicks}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Interval: {btn.lastDeltaMs !== null ? `${btn.lastDeltaMs.toFixed(1)} ms` : '-- ms'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={btn.faults > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                          Faults: {btn.faults}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Scroll Encoder Progressing Graph & Live Event Log */}
              <div
                className={`p-6 rounded-xl border space-y-4 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">02. Scroll Encoder Progressing Graph</h2>
                  <span className="text-xs font-mono tabular-nums text-sky-400">
                    Net Pos: {scrollCumulative > 0 ? `+${scrollCumulative}` : scrollCumulative} · Up: {scrollUpCount} · Down: {scrollDownCount}
                  </span>
                </div>

                <div
                  onWheel={handleArenaWheel}
                  className={`p-3.5 rounded-xl border select-none h-48 flex flex-col justify-between ${
                    scrollGlitches > 0
                      ? 'border-red-500/70 bg-red-500/5'
                      : darkMode
                      ? 'border-slate-800 bg-slate-950'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
                    <div className="flex flex-wrap items-center gap-4 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#22c55e] inline-block" />
                        <span>Up</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#2563eb] inline-block" />
                        <span>Down</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#d97706] inline-block" />
                        <span>Analyzing</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#dc2626] inline-block" />
                        <span>Encoder error</span>
                      </span>
                    </div>
                    <span className={`font-mono ${scrollGlitches > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}`}>
                      Errors: {scrollGlitches}
                    </span>
                  </div>

                  {renderScrollGraphSvg()}
                </div>

                <div>
                  <h3 className="text-xs font-semibold mb-2">Real-Time Switch & Encoder Event Log (O(1) Ring Buffer)</h3>
                  <div
                    className={`p-3.5 rounded-lg border h-44 overflow-y-auto font-mono text-xs space-y-1.5 ${
                      darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {mouseLogs.length === 0 ? (
                      <p className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                        No mouse events logged yet. Click or scroll in the test area to inspect switch timings.
                      </p>
                    ) : (
                      mouseLogs.map((item) => (
                        <div
                          key={item.id}
                          className={
                            item.fault ? 'text-red-400 font-semibold' : darkMode ? 'text-slate-300' : 'text-slate-700'
                          }
                        >
                          {item.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =====================================================================
             TAB 3: SPEAKER FREQUENCY SWEEP, SYNTH & L/R CHANNEL BALANCE
             ===================================================================== */
          <div
            className={`p-6 rounded-xl border space-y-6 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
              <div>
                <h2 className="text-lg font-semibold">
                  Speaker Frequency Sweep, Synth & Stereo Channel Balance
                </h2>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Synthesizes click-free 44.1 kHz 16-bit Stereo PCM sine waves and built-in harmonic synth through L/R balance controls.
                </p>
              </div>

              <button
                onClick={() => (speakerPlaying ? stopAudio() : startAudio())}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  speakerPlaying
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {speakerPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{speakerPlaying ? 'STOP AUDIO TEST' : 'START AUDIO TEST'}</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      sweepProgressRef.current = 0;
                      setSpeakerMode('sweep');
                      if (speakerPlaying) startAudio('sweep');
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      speakerMode === 'sweep'
                        ? 'bg-sky-500 text-slate-950 border-sky-500'
                        : darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    Logarithmic Sweep (20 Hz – 20,000 Hz)
                  </button>

                  <button
                    onClick={() => {
                      setSpeakerMode('fixed');
                      setFrequencyHz(fixedFreqHz);
                      if (speakerPlaying) startAudio('fixed');
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      speakerMode === 'fixed'
                        ? 'bg-sky-500 text-slate-950 border-sky-500'
                        : darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    Manual Fixed Frequency
                  </button>

                  {/* Synth Button placed directly on the right side of Manual Fixed Frequency */}
                  <button
                    onClick={() => {
                      setSpeakerMode('synth');
                      if (speakerPlaying) startAudio('synth');
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      speakerMode === 'synth'
                        ? 'bg-sky-500 text-slate-950 border-sky-500'
                        : darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Synth</span>
                  </button>
                </div>

                <div className="text-base font-mono font-bold tabular-nums text-sky-400">
                  {speakerMode === 'synth'
                    ? `Built-in Synth (${Math.round(frequencyHz)} Hz)`
                    : `${Math.round(frequencyHz).toLocaleString()} Hz`}
                </div>
              </div>

              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={Math.round((Math.log(frequencyHz / 20) / Math.log(20000 / 20)) * 1000)}
                  onChange={(e) => {
                    const norm = Number(e.target.value) / 1000;
                    const hz = 20 * Math.pow(20000 / 20, norm);
                    setSpeakerMode('fixed');
                    setFixedFreqHz(hz);
                    setFrequencyHz(hz);
                  }}
                  className="w-full h-3 rounded-lg accent-sky-400 cursor-pointer"
                />
                <div
                  className={`flex justify-between text-xs font-mono ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <span>20 Hz (Sub-Bass)</span>
                  <span>100 Hz (Bass)</span>
                  <span>1,000 Hz (Midrange)</span>
                  <span>5,000 Hz (Presence)</span>
                  <span>20,000 Hz (Brilliance)</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-sm font-semibold">Left & Right Stereo Channel Balance Test</h3>
                <span className="text-xs font-mono tabular-nums text-sky-400">
                  {balance < -0.02
                    ? `Balance: ${Math.round(-balance * 100)}% Left`
                    : balance > 0.02
                    ? `Balance: ${Math.round(balance * 100)}% Right`
                    : 'Balance: Center (50% L / 50% R)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setBalance(-1)}
                  className={`py-3 px-4 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    balance <= -0.95
                      ? 'bg-sky-500 text-slate-950 border-sky-500'
                      : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Left Speaker Only (L)</span>
                </button>

                <button
                  onClick={() => setBalance(0)}
                  className={`py-3 px-4 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    Math.abs(balance) < 0.05
                      ? 'bg-sky-500 text-slate-950 border-sky-500'
                      : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Both Speakers (Center L+R)</span>
                </button>

                <button
                  onClick={() => setBalance(1)}
                  className={`py-3 px-4 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    balance >= 0.95
                      ? 'bg-sky-500 text-slate-950 border-sky-500'
                      : darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Right Speaker Only (R)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Continuous L/R Panning Slider</label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={Math.round(balance * 100)}
                    onChange={(e) => setBalance(Number(e.target.value) / 100)}
                    className="w-full h-2.5 rounded-lg accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 flex items-center justify-between">
                    <span>Output Gain Volume (Default: 1%)</span>
                    <span className="font-mono tabular-nums">{Math.round(volume * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(volume * 100)}
                      onChange={(e) => setVolume(Number(e.target.value) / 100)}
                      className="w-full h-2.5 rounded-lg accent-emerald-400 cursor-pointer"
                    />
                    <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permanent bottom ⓘ shortcut info across the app */}
        <footer
          className={`mt-6 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium select-none ${
            darkMode
              ? 'bg-slate-900/70 border-slate-800 text-slate-400'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <span className="text-sky-400 text-sm leading-none">ⓘ</span>
          <span>Shortcut: Press Space 5 times to enable mouse and keyboard</span>
        </footer>
      </main>
    </div>
  );
}
