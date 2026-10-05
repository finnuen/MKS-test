// ============================================================================
// MKS-test v1.0 (Mouse, Keyboard, Speaker Hardware Diagnostics Utility)
// 100% Pure C++ & Native Win32 API (Zero External Dependencies)
// ============================================================================
// Architectural Optimizations Over Baseline:
// 1. Zero-Allocation GDI Paint Loop:
//    - Caches DPI-aware HFONT handles and persistent off-screen backbuffer
//      (HDC/HBITMAP) across frames; uses DC_BRUSH and DC_PEN stock objects
//      to eliminate >220 GDI handle allocations per WM_PAINT.
// 2. O(1) Ring Buffers for Real-Time Input Telemetry:
//    - Replaces std::vector::insert/erase heap churn on high-rate mouse click
//      and scroll-wheel paths with fixed-capacity circular ring buffers.
// 3. Deadlock-Free WaveOut PCM Synthesizer (MM_WOM_DONE):
//    - Uses CALLBACK_WINDOW (MM_WOM_DONE) instead of calling waveOutWrite
//      inside WaveOutProc, with static pre-allocated stereo PCM buffers and
//      exponential parameter smoothing to eliminate audio zipper clicks.
// 4. Full 104-Key Scan-Code Disambiguation + NKRO Rollover Tracking:
//    - Distinguishes Standard Enter vs. Extended Numpad Enter and Left/Right
//      modifiers via WH_KEYBOARD_LL flags, plus interactive virtual key clicks.
//
// Compile with MSVC (Developer Command Prompt):
//   cl.exe /O2 /MT /GL /EHsc /DUNICODE /D_UNICODE main.cpp /link /LTCG /OPT:REF /OPT:ICF user32.lib gdi32.lib comctl32.lib comdlg32.lib winmm.lib dwmapi.lib /SUBSYSTEM:WINDOWS /OUT:HardwareDiagnostics.exe
//
// Compile with MinGW-w64 (G++):
//   g++ -O3 -flto -s -mwindows -static -DUNICODE -D_UNICODE main.cpp -o HardwareDiagnostics.exe -luser32 -lgdi32 -lcomctl32 -lcomdlg32 -lwinmm -ldwmapi
// ============================================================================

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <commctrl.h>
#include <commdlg.h>
#include <mmsystem.h>
#include <wchar.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <vector>

// Enable Common Controls v6 for crisp modern visual styles
#pragma comment(linker, "\"/manifestdependency:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")

// Standard Windows system libraries
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "advapi32.lib")

#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
#define DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 ((DPI_AWARENESS_CONTEXT)-4)
#endif

// Synthetic virtual-key slot used to separate Numpad Enter from main Enter
#define VK_NUMPAD_ENTER_SYNTH 0xE8

// ============================================================================
// Application Enums & Theme Palette
// ============================================================================
enum AppTab {
    TAB_KEYBOARD = 0,
    TAB_MOUSE    = 1,
    TAB_SPEAKER  = 2
};

enum SpeakerAudioMode {
    SPK_MODE_SWEEP = 0,
    SPK_MODE_FIXED = 1,
    SPK_MODE_SYNTH = 2
};

struct ThemeColors {
    COLORREF bgCanvas;
    COLORREF bgSurface;
    COLORREF bgElevated;
    COLORREF border;
    COLORREF textPrimary;
    COLORREF textSecondary;
    COLORREF accent;
    COLORREF accentHover;
    COLORREF keyIdle;
    COLORREF keyDown;
    COLORREF keyLatched;
    COLORREF danger;
    COLORREF warning;
};

static const ThemeColors THEME_DARK = {
    RGB(15, 23, 42),    // bgCanvas (#0F172A)
    RGB(30, 41, 59),    // bgSurface (#1E293B)
    RGB(51, 65, 85),    // bgElevated (#334155)
    RGB(71, 85, 105),   // border (#475569)
    RGB(248, 250, 252), // textPrimary (#F8FAFC)
    RGB(148, 163, 184), // textSecondary (#94A3B8)
    RGB(56, 189, 248),  // accent (#38BDF8)
    RGB(14, 165, 233),  // accentHover (#0EA5E9)
    RGB(30, 41, 59),    // keyIdle
    RGB(56, 189, 248),  // keyDown (Active press)
    RGB(16, 185, 129),  // keyLatched (Tested & stayed lit #10B981)
    RGB(239, 68, 68),   // danger (#EF4444)
    RGB(245, 158, 11)   // warning (#F59E0B)
};

static const ThemeColors THEME_LIGHT = {
    RGB(248, 250, 252), // bgCanvas (#F8FAFC)
    RGB(255, 255, 255), // bgSurface (#FFFFFF)
    RGB(241, 245, 249), // bgElevated (#F1F5F9)
    RGB(203, 213, 225), // border (#CBD5E1)
    RGB(15, 23, 42),    // textPrimary (#0F172A)
    RGB(100, 116, 139), // textSecondary (#64748B)
    RGB(2, 132, 199),   // accent (#0284C7)
    RGB(3, 105, 161),   // accentHover (#0369A1)
    RGB(255, 255, 255), // keyIdle
    RGB(2, 132, 199),   // keyDown
    RGB(22, 163, 74),   // keyLatched (#16A34A)
    RGB(220, 38, 38),   // danger (#DC2626)
    RGB(217, 119, 6)    // warning (#D97706)
};

// ============================================================================
// Keyboard Layout Model (Full 104-Key ANSI Layout)
// ============================================================================
struct KeyDef {
    UINT vk;
    const wchar_t* label;
    float x;
    float y;
    float w;
    float h;
    bool ext;
};

static const KeyDef g_KeyboardLayout[] = {
    // Row 0: Function Row (16 keys) - Main block 0..15u, Nav block 15.5..18.5u
    { VK_ESCAPE,   L"Esc",   0.0f,  0.0f, 1.0f, 1.0f, false },
    { VK_F1,       L"F1",    2.0f,  0.0f, 1.0f, 1.0f, false },
    { VK_F2,       L"F2",    3.0f,  0.0f, 1.0f, 1.0f, false },
    { VK_F3,       L"F3",    4.0f,  0.0f, 1.0f, 1.0f, false },
    { VK_F4,       L"F4",    5.0f,  0.0f, 1.0f, 1.0f, false },
    { VK_F5,       L"F5",    6.5f,  0.0f, 1.0f, 1.0f, false },
    { VK_F6,       L"F6",    7.5f,  0.0f, 1.0f, 1.0f, false },
    { VK_F7,       L"F7",    8.5f,  0.0f, 1.0f, 1.0f, false },
    { VK_F8,       L"F8",    9.5f,  0.0f, 1.0f, 1.0f, false },
    { VK_F9,       L"F9",    11.0f, 0.0f, 1.0f, 1.0f, false },
    { VK_F10,      L"F10",   12.0f, 0.0f, 1.0f, 1.0f, false },
    { VK_F11,      L"F11",   13.0f, 0.0f, 1.0f, 1.0f, false },
    { VK_F12,      L"F12",   14.0f, 0.0f, 1.0f, 1.0f, false },
    { VK_SNAPSHOT, L"PrtSc", 15.5f, 0.0f, 1.0f, 1.0f, true  },
    { VK_SCROLL,   L"ScrLk", 16.5f, 0.0f, 1.0f, 1.0f, false },
    { VK_PAUSE,    L"Pause", 17.5f, 0.0f, 1.0f, 1.0f, false },

    // Row 1: Number Row + Nav + Numpad (21 keys) - Numpad 19.0..23.0u
    { VK_OEM_3,     L"` ~",       0.0f,  1.25f, 1.0f, 1.0f, false },
    { '1',          L"1",         1.0f,  1.25f, 1.0f, 1.0f, false },
    { '2',          L"2",         2.0f,  1.25f, 1.0f, 1.0f, false },
    { '3',          L"3",         3.0f,  1.25f, 1.0f, 1.0f, false },
    { '4',          L"4",         4.0f,  1.25f, 1.0f, 1.0f, false },
    { '5',          L"5",         5.0f,  1.25f, 1.0f, 1.0f, false },
    { '6',          L"6",         6.0f,  1.25f, 1.0f, 1.0f, false },
    { '7',          L"7",         7.0f,  1.25f, 1.0f, 1.0f, false },
    { '8',          L"8",         8.0f,  1.25f, 1.0f, 1.0f, false },
    { '9',          L"9",         9.0f,  1.25f, 1.0f, 1.0f, false },
    { '0',          L"0",         10.0f, 1.25f, 1.0f, 1.0f, false },
    { VK_OEM_MINUS, L"-",         11.0f, 1.25f, 1.0f, 1.0f, false },
    { VK_OEM_PLUS,  L"=",         12.0f, 1.25f, 1.0f, 1.0f, false },
    { VK_BACK,      L"Backspace", 13.0f, 1.25f, 2.0f, 1.0f, false },
    { VK_INSERT,    L"Ins",       15.5f, 1.25f, 1.0f, 1.0f, true  },
    { VK_HOME,      L"Home",      16.5f, 1.25f, 1.0f, 1.0f, true  },
    { VK_PRIOR,     L"PgUp",      17.5f, 1.25f, 1.0f, 1.0f, true  },
    { VK_NUMLOCK,   L"Num",       19.0f, 1.25f, 1.0f, 1.0f, true  },
    { VK_DIVIDE,    L"/",         20.0f, 1.25f, 1.0f, 1.0f, true  },
    { VK_MULTIPLY,  L"*",         21.0f, 1.25f, 1.0f, 1.0f, false },
    { VK_SUBTRACT,  L"-",         22.0f, 1.25f, 1.0f, 1.0f, false },

    // Row 2: QWERTY Row + Nav + Numpad (21 keys)
    { VK_TAB,    L"Tab",  0.0f,  2.25f, 1.5f, 1.0f, false },
    { 'Q',       L"Q",    1.5f,  2.25f, 1.0f, 1.0f, false },
    { 'W',       L"W",    2.5f,  2.25f, 1.0f, 1.0f, false },
    { 'E',       L"E",    3.5f,  2.25f, 1.0f, 1.0f, false },
    { 'R',       L"R",    4.5f,  2.25f, 1.0f, 1.0f, false },
    { 'T',       L"T",    5.5f,  2.25f, 1.0f, 1.0f, false },
    { 'Y',       L"Y",    6.5f,  2.25f, 1.0f, 1.0f, false },
    { 'U',       L"U",    7.5f,  2.25f, 1.0f, 1.0f, false },
    { 'I',       L"I",    8.5f,  2.25f, 1.0f, 1.0f, false },
    { 'O',       L"O",    9.5f,  2.25f, 1.0f, 1.0f, false },
    { 'P',       L"P",    10.5f, 2.25f, 1.0f, 1.0f, false },
    { VK_OEM_4,  L"[",    11.5f, 2.25f, 1.0f, 1.0f, false },
    { VK_OEM_6,  L"]",    12.5f, 2.25f, 1.0f, 1.0f, false },
    { VK_OEM_5,  L"\\",   13.5f, 2.25f, 1.5f, 1.0f, false },
    { VK_DELETE, L"Del",  15.5f, 2.25f, 1.0f, 1.0f, true  },
    { VK_END,    L"End",  16.5f, 2.25f, 1.0f, 1.0f, true  },
    { VK_NEXT,   L"PgDn", 17.5f, 2.25f, 1.0f, 1.0f, true  },
    { VK_NUMPAD7, L"7",   19.0f, 2.25f, 1.0f, 1.0f, false },
    { VK_NUMPAD8, L"8",   20.0f, 2.25f, 1.0f, 1.0f, false },
    { VK_NUMPAD9, L"9",   21.0f, 2.25f, 1.0f, 1.0f, false },
    { VK_ADD,     L"+",   22.0f, 2.25f, 1.0f, 2.0f, false },

    // Row 3: ASDF Row + Numpad (16 keys)
    { VK_CAPITAL, L"Caps",  0.0f,  3.25f, 1.75f, 1.0f, false },
    { 'A',        L"A",     1.75f, 3.25f, 1.0f,  1.0f, false },
    { 'S',        L"S",     2.75f, 3.25f, 1.0f,  1.0f, false },
    { 'D',        L"D",     3.75f, 3.25f, 1.0f,  1.0f, false },
    { 'F',        L"F",     4.75f, 3.25f, 1.0f,  1.0f, false },
    { 'G',        L"G",     5.75f, 3.25f, 1.0f,  1.0f, false },
    { 'H',        L"H",     6.75f, 3.25f, 1.0f,  1.0f, false },
    { 'J',        L"J",     7.75f, 3.25f, 1.0f,  1.0f, false },
    { 'K',        L"K",     8.75f, 3.25f, 1.0f,  1.0f, false },
    { 'L',        L"L",     9.75f, 3.25f, 1.0f,  1.0f, false },
    { VK_OEM_1,   L";",     10.75f, 3.25f, 1.0f, 1.0f, false },
    { VK_OEM_7,   L"'",     11.75f, 3.25f, 1.0f, 1.0f, false },
    { VK_RETURN,  L"Enter", 12.75f, 3.25f, 2.25f, 1.0f, false },
    { VK_NUMPAD4, L"4",     19.0f, 3.25f, 1.0f,  1.0f, false },
    { VK_NUMPAD5, L"5",     20.0f, 3.25f, 1.0f,  1.0f, false },
    { VK_NUMPAD6, L"6",     21.0f, 3.25f, 1.0f,  1.0f, false },

    // Row 4: ZXCV Row + Up Arrow + Numpad (17 keys, including Numpad Enter)
    { VK_LSHIFT,             L"Shift",  0.0f,  4.25f, 2.25f, 1.0f, false },
    { 'Z',                   L"Z",      2.25f, 4.25f, 1.0f,  1.0f, false },
    { 'X',                   L"X",      3.25f, 4.25f, 1.0f,  1.0f, false },
    { 'C',                   L"C",      4.25f, 4.25f, 1.0f,  1.0f, false },
    { 'V',                   L"V",      5.25f, 4.25f, 1.0f,  1.0f, false },
    { 'B',                   L"B",      6.25f, 4.25f, 1.0f,  1.0f, false },
    { 'N',                   L"N",      7.25f, 4.25f, 1.0f,  1.0f, false },
    { 'M',                   L"M",      8.25f, 4.25f, 1.0f,  1.0f, false },
    { VK_OEM_COMMA,          L",",      9.25f, 4.25f, 1.0f,  1.0f, false },
    { VK_OEM_PERIOD,         L".",      10.25f, 4.25f, 1.0f, 1.0f, false },
    { VK_OEM_2,              L"/",      11.25f, 4.25f, 1.0f, 1.0f, false },
    { VK_RSHIFT,             L"RShift", 12.25f, 4.25f, 2.75f, 1.0f, true  },
    { VK_UP,                 L"Up",     16.5f, 4.25f, 1.0f,  1.0f, true  },
    { VK_NUMPAD1,            L"1",      19.0f, 4.25f, 1.0f,  1.0f, false },
    { VK_NUMPAD2,            L"2",      20.0f, 4.25f, 1.0f,  1.0f, false },
    { VK_NUMPAD3,            L"3",      21.0f, 4.25f, 1.0f,  1.0f, false },
    { VK_NUMPAD_ENTER_SYNTH, L"Ent",    22.0f, 4.25f, 1.0f,  2.0f, true  },

    // Row 5: Bottom Modifiers + Arrows + Numpad (13 keys) -> Total = 104 keys
    { VK_LCONTROL, L"Ctrl",  0.0f,  5.25f, 1.25f, 1.0f, false },
    { VK_LWIN,     L"Win",   1.25f, 5.25f, 1.25f, 1.0f, true  },
    { VK_LMENU,    L"Alt",   2.5f,  5.25f, 1.25f, 1.0f, false },
    { VK_SPACE,    L"Space", 3.75f, 5.25f, 6.25f, 1.0f, false },
    { VK_RMENU,    L"RAlt",  10.0f, 5.25f, 1.25f, 1.0f, true  },
    { VK_RWIN,     L"RWin",  11.25f, 5.25f, 1.25f, 1.0f, true  },
    { VK_APPS,     L"Menu",  12.5f, 5.25f, 1.25f, 1.0f, true  },
    { VK_RCONTROL, L"RCtrl", 13.75f, 5.25f, 1.25f, 1.0f, true  },
    { VK_LEFT,     L"Left",  15.5f, 5.25f, 1.0f,  1.0f, true  },
    { VK_DOWN,     L"Down",  16.5f, 5.25f, 1.0f,  1.0f, true  },
    { VK_RIGHT,    L"Right", 17.5f, 5.25f, 1.0f,  1.0f, true  },
    { VK_NUMPAD0,  L"0",     19.0f, 5.25f, 2.0f,  1.0f, false },
    { VK_DECIMAL,  L".",     21.0f, 5.25f, 1.0f,  1.0f, false }
};

static const int g_KeyCount = sizeof(g_KeyboardLayout) / sizeof(g_KeyboardLayout[0]);

// ============================================================================
// Fixed-Capacity O(1) Ring Buffers (Zero Heap Allocations in Input Paths)
// ============================================================================
enum ScrollTickState {
    TICK_NORMAL    = 0,
    TICK_ANALYZING = 1,
    TICK_ERROR     = 2
};

struct ScrollGraphPoint {
    int stepDir;          // +1 (UP, bar above line) or -1 (DOWN, bar below line)
    int state;            // TICK_NORMAL, TICK_ANALYZING, TICK_ERROR
    LONGLONG tickTime;    // QPC timestamp for Analyzing -> Normal transition
};

struct MouseLogEntry {
    wchar_t text[128];
    bool isFault;
};

static const int MAX_SCROLL_SAMPLES = 128;
static const int MAX_MOUSE_LOGS     = 8;
static const int AUDIO_SAMPLE_RATE    = 44100;
static const int AUDIO_BUFFER_SAMPLES = 1470; // 33.3ms per buffer @ 44.1kHz
static const int AUDIO_NUM_BUFFERS    = 4;

// ============================================================================
// Global Application State
// ============================================================================
struct AppState {
    HWND hwnd;
    AppTab currentTab;
    bool darkMode;
    UINT dpi;
    wchar_t settingsFilePath[MAX_PATH];

    // Cached GDI Fonts & Persistent Backbuffer (Zero per-frame allocation)
    HFONT hFontTitle;
    HFONT hFontBody;
    HFONT hFontSmall;
    HFONT hFontKey;
    HDC hdcBack;
    HBITMAP hbmBack;
    HGDIOBJ hOldBmBack;
    int backW;
    int backH;

    // Keyboard state
    bool keyCurrentlyDown[256];
    bool keyLatched[256];
    bool asyncPolledDown[256];
    RECT keyHitRects[128];
    int activeVirtualKeyDown;
    bool disableKeyboard;
    bool blockWinShortcuts;
    UINT lastVkCode;
    UINT lastScanCode;
    wchar_t lastKeyLabel[64];
    int totalKeyPresses;
    int currentRolloverCount;
    int peakRolloverCount;

    // Mouse state
    bool disableMouse;
    bool mouseBtnDown[5];
    int mouseClickCount[5];
    int mouseDoubleClickFaults[5];
    double lastClickDeltaMs[5];
    LONGLONG lastClickTick[5];
    LONGLONG qpcFreq;
    double doubleClickThresholdMs;

    // Scroll Encoder state + O(1) Ring Buffers
    int scrollUpSteps;
    int scrollDownSteps;
    int scrollCumulativePos;
    int scrollEncoderGlitches;
    int lastScrollDirection;
    LONGLONG lastScrollTick;

    ScrollGraphPoint scrollRing[MAX_SCROLL_SAMPLES];
    int scrollRingHead;
    int scrollRingCount;

    MouseLogEntry mouseLogRing[MAX_MOUSE_LOGS];
    int mouseLogCount;

    // Speaker Audio Synthesis & Custom Music state
    bool speakerPlaying;
    SpeakerAudioMode speakerMode;
    double currentFreqHz;
    double fixedFreqHz;
    double smoothedFreqHz;
    double sweepStartHz;
    double sweepEndHz;
    double sweepProgress;
    double phaseAccumulator;
    float channelBalance;
    float masterVolume;
    float smoothedLeftGain;
    float smoothedRightGain;

    // Built-In Synth state
    double synthMusicTimeSec;

    // 5x Spacebar Unlock state
    bool spacePhysDown;
    int spacePressCount;
    DWORD lastSpaceTick;

    // Hardware Device Names
    wchar_t mouseDeviceName[128];
    wchar_t keyboardDeviceName[128];
    wchar_t speakerDeviceName[128];
    int mouseDeviceScore;
    int keyboardDeviceScore;

    HWAVEOUT hWaveOut;
    WAVEHDR waveHeaders[AUDIO_NUM_BUFFERS];
    short waveBuffers[AUDIO_NUM_BUFFERS][AUDIO_BUFFER_SAMPLES * 2];

    bool draggingFreqSlider;
    bool draggingBalanceSlider;
    bool draggingVolumeSlider;

    // Interactive UI Hit Rectangles
    RECT rcTabKeyboard;
    RECT rcTabMouse;
    RECT rcTabSpeaker;
    RECT rcBtnDarkMode;

    // Keyboard Tab Buttons
    RECT rcBtnDisableKeyboard;
    RECT rcBtnResetKeyboard;
    RECT rcBtnToggleShortcutGuard;

    // Mouse Tab Buttons
    RECT rcBtnDisableMouse;
    RECT rcBtnResetMouse;
    RECT rcMouseTestArena;

    // Speaker Tab Controls
    RECT rcBtnPlayToggle;
    RECT rcBtnModeSweep;
    RECT rcBtnModeFixed;
    RECT rcBtnModeSynth;
    RECT rcSliderFreq;
    RECT rcBtnChanLeft;
    RECT rcBtnChanCenter;
    RECT rcBtnChanRight;
    RECT rcSliderBalance;
    RECT rcSliderVolume;
};

static AppState g_App = {};
static HHOOK g_hKeyboardHook = NULL;
static HHOOK g_hMouseHook = NULL;

inline int ScaleDPI(int val) {
    return MulDiv(val, g_App.dpi ? g_App.dpi : 96, 96);
}

// ============================================================================
// GDI Font & Backbuffer Cache Management
// ============================================================================
void RebuildFontsForDPI() {
    if (g_App.hFontTitle) { DeleteObject(g_App.hFontTitle); g_App.hFontTitle = NULL; }
    if (g_App.hFontBody)  { DeleteObject(g_App.hFontBody);  g_App.hFontBody  = NULL; }
    if (g_App.hFontSmall) { DeleteObject(g_App.hFontSmall); g_App.hFontSmall = NULL; }
    if (g_App.hFontKey)   { DeleteObject(g_App.hFontKey);   g_App.hFontKey   = NULL; }

    g_App.hFontTitle = CreateFontW(-ScaleDPI(16), 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
    g_App.hFontBody  = CreateFontW(-ScaleDPI(13), 0, 0, 0, FW_MEDIUM, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
    g_App.hFontSmall = CreateFontW(-ScaleDPI(12), 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
    g_App.hFontKey   = CreateFontW(-ScaleDPI(11), 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI");
}

void ReleaseGdiCache() {
    if (g_App.hdcBack) {
        if (g_App.hOldBmBack) SelectObject(g_App.hdcBack, g_App.hOldBmBack);
        if (g_App.hbmBack) DeleteObject(g_App.hbmBack);
        DeleteDC(g_App.hdcBack);
        g_App.hdcBack = NULL;
        g_App.hbmBack = NULL;
        g_App.hOldBmBack = NULL;
        g_App.backW = 0;
        g_App.backH = 0;
    }
    if (g_App.hFontTitle) { DeleteObject(g_App.hFontTitle); g_App.hFontTitle = NULL; }
    if (g_App.hFontBody)  { DeleteObject(g_App.hFontBody);  g_App.hFontBody  = NULL; }
    if (g_App.hFontSmall) { DeleteObject(g_App.hFontSmall); g_App.hFontSmall = NULL; }
    if (g_App.hFontKey)   { DeleteObject(g_App.hFontKey);   g_App.hFontKey   = NULL; }
}

void RecalculateRollover() {
    int count = 0;
    for (int i = 0; i < 256; ++i) {
        if (g_App.keyCurrentlyDown[i]) count++;
    }
    g_App.currentRolloverCount = count;
    if (count > g_App.peakRolloverCount) {
        g_App.peakRolloverCount = count;
    }
}

void PushMouseLog(const wchar_t* msg, bool isFault) {
    for (int i = MAX_MOUSE_LOGS - 1; i > 0; --i) {
        g_App.mouseLogRing[i] = g_App.mouseLogRing[i - 1];
    }
    wcsncpy(g_App.mouseLogRing[0].text, msg, 127);
    g_App.mouseLogRing[0].text[127] = L'\0';
    g_App.mouseLogRing[0].isFault = isFault;
    if (g_App.mouseLogCount < MAX_MOUSE_LOGS) {
        g_App.mouseLogCount++;
    }
}

void PushScrollSample(int stepDir, int state, LONGLONG tickTime) {
    int writeIdx = (g_App.scrollRingHead + g_App.scrollRingCount) % MAX_SCROLL_SAMPLES;
    if (g_App.scrollRingCount == MAX_SCROLL_SAMPLES) {
        g_App.scrollRingHead = (g_App.scrollRingHead + 1) % MAX_SCROLL_SAMPLES;
    } else {
        g_App.scrollRingCount++;
    }
    g_App.scrollRing[writeIdx].stepDir  = stepDir;
    g_App.scrollRing[writeIdx].state    = state;
    g_App.scrollRing[writeIdx].tickTime = tickTime;
}

// ============================================================================
// Persistent Settings in %APPDATA%\HardwareDiagnostics\settings.ini
// ============================================================================
void InitSettingsFilePath() {
    wchar_t appDataDir[MAX_PATH] = { 0 };
    DWORD len = GetEnvironmentVariableW(L"APPDATA", appDataDir, MAX_PATH);
    if (len == 0 || len >= MAX_PATH) {
        GetCurrentDirectoryW(MAX_PATH, appDataDir);
    }
    wchar_t folderPath[MAX_PATH];
    swprintf(folderPath, MAX_PATH, L"%s\\HardwareDiagnostics", appDataDir);
    CreateDirectoryW(folderPath, NULL);
    swprintf(g_App.settingsFilePath, MAX_PATH, L"%s\\settings.ini", folderPath);
}

bool LoadCustomWavFile(const wchar_t* filePath);

void SaveAppSettings() {
    if (g_App.settingsFilePath[0] == L'\0') return;

    wchar_t buf[128];
    swprintf(buf, 128, L"%d", g_App.darkMode ? 1 : 0);
    WritePrivateProfileStringW(L"General", L"DarkMode", buf, g_App.settingsFilePath);

    swprintf(buf, 128, L"%d", (int)g_App.currentTab);
    WritePrivateProfileStringW(L"General", L"ActiveTab", buf, g_App.settingsFilePath);

    swprintf(buf, 128, L"%d", g_App.blockWinShortcuts ? 1 : 0);
    WritePrivateProfileStringW(L"Keyboard", L"BlockWinShortcuts", buf, g_App.settingsFilePath);

    swprintf(buf, 128, L"%d", (int)g_App.speakerMode);
    WritePrivateProfileStringW(L"Speaker", L"SpeakerMode", buf, g_App.settingsFilePath);

    swprintf(buf, 128, L"%.2f", g_App.fixedFreqHz);
    WritePrivateProfileStringW(L"Speaker", L"FixedFrequencyHz", buf, g_App.settingsFilePath);

    swprintf(buf, 128, L"%d", (int)(g_App.channelBalance * 100.0f));
    WritePrivateProfileStringW(L"Speaker", L"ChannelBalancePct", buf, g_App.settingsFilePath);

    swprintf(buf, 128, L"%d", (int)(g_App.masterVolume * 100.0f));
    WritePrivateProfileStringW(L"Speaker", L"MasterVolumePct_v10", buf, g_App.settingsFilePath);

    if (g_App.hwnd && !IsIconic(g_App.hwnd) && !IsZoomed(g_App.hwnd)) {
        RECT wr;
        if (GetWindowRect(g_App.hwnd, &wr)) {
            swprintf(buf, 128, L"%d", wr.left);
            WritePrivateProfileStringW(L"Window", L"X", buf, g_App.settingsFilePath);
            swprintf(buf, 128, L"%d", wr.top);
            WritePrivateProfileStringW(L"Window", L"Y", buf, g_App.settingsFilePath);
            swprintf(buf, 128, L"%d", wr.right - wr.left);
            WritePrivateProfileStringW(L"Window", L"W", buf, g_App.settingsFilePath);
            swprintf(buf, 128, L"%d", wr.bottom - wr.top);
            WritePrivateProfileStringW(L"Window", L"H", buf, g_App.settingsFilePath);
        }
    }
}

void LoadAppSettings() {
    InitSettingsFilePath();

    int dark = GetPrivateProfileIntW(L"General", L"DarkMode", 1, g_App.settingsFilePath);
    g_App.darkMode = (dark != 0);

    int tab = GetPrivateProfileIntW(L"General", L"ActiveTab", 1, g_App.settingsFilePath);
    if (tab >= 0 && tab <= 2) g_App.currentTab = (AppTab)tab;

    int blockSc = GetPrivateProfileIntW(L"Keyboard", L"BlockWinShortcuts", 1, g_App.settingsFilePath);
    g_App.blockWinShortcuts = (blockSc != 0);

    int spkMode = GetPrivateProfileIntW(L"Speaker", L"SpeakerMode", 0, g_App.settingsFilePath);
    if (spkMode >= 0 && spkMode <= 2) g_App.speakerMode = (SpeakerAudioMode)spkMode;

    wchar_t freqBuf[64] = { 0 };
    GetPrivateProfileStringW(L"Speaker", L"FixedFrequencyHz", L"440.0", freqBuf, 64, g_App.settingsFilePath);
    double loadedFreq = _wtof(freqBuf);
    if (loadedFreq >= 20.0 && loadedFreq <= 20000.0) {
        g_App.fixedFreqHz = loadedFreq;
        g_App.currentFreqHz = loadedFreq;
        g_App.smoothedFreqHz = loadedFreq;
    }

    int balPct = GetPrivateProfileIntW(L"Speaker", L"ChannelBalancePct", 0, g_App.settingsFilePath);
    if (balPct >= -100 && balPct <= 100) {
        g_App.channelBalance = (float)balPct / 100.0f;
    }

    int volPct = GetPrivateProfileIntW(L"Speaker", L"MasterVolumePct_v10", 1, g_App.settingsFilePath);
    if (volPct >= 0 && volPct <= 100) {
        g_App.masterVolume = (float)volPct / 100.0f;
    }
}

// ============================================================================
// Audio Engine (Real-Time 44.1kHz 16-bit Stereo Sine, Sweep & Built-In Synth)
// Uses CALLBACK_WINDOW (MM_WOM_DONE) for Deadlock-Free WinMM Buffer Streaming
// ============================================================================
static const double MELODY_NOTES_HZ[16] = {
    261.63, 329.63, 392.00, 523.25,
    293.66, 369.99, 440.00, 587.33,
    329.63, 415.30, 493.88, 659.25,
    261.63, 392.00, 523.25, 392.00
};

void FillAudioBuffer(short* buffer, int numFrames) {
    if (!g_App.speakerPlaying) {
        memset(buffer, 0, numFrames * 2 * sizeof(short));
        return;
    }

    const double twoPi = 6.28318530717958647692;
    float bal = g_App.channelBalance;
    float targetLeftGain  = ((bal <= 0.0f) ? 1.0f : (1.0f - bal)) * g_App.masterVolume;
    float targetRightGain = ((bal >= 0.0f) ? 1.0f : (1.0f + bal)) * g_App.masterVolume;

    if (g_App.speakerMode == SPK_MODE_SYNTH) {
        for (int i = 0; i < numFrames; ++i) {
            g_App.smoothedLeftGain  += 0.005f * (targetLeftGain  - g_App.smoothedLeftGain);
            g_App.smoothedRightGain += 0.005f * (targetRightGain - g_App.smoothedRightGain);
            g_App.synthMusicTimeSec += 1.0 / (double)AUDIO_SAMPLE_RATE;
            int step = ((int)(g_App.synthMusicTimeSec * 5.0)) & 15;
            double noteHz = MELODY_NOTES_HZ[step];
            g_App.currentFreqHz = noteHz;

            double env = 1.0 - fmod(g_App.synthMusicTimeSec * 5.0, 1.0) * 0.55;
            double fundamental = sin(g_App.phaseAccumulator);
            double harmonic2   = 0.35 * sin(g_App.phaseAccumulator * 2.0);
            double subBass     = 0.25 * sin(g_App.phaseAccumulator * 0.5);
            double wave = (fundamental + harmonic2 + subBass) * 0.65 * env * 18000.0;

            g_App.phaseAccumulator += twoPi * noteHz / (double)AUDIO_SAMPLE_RATE;
            if (g_App.phaseAccumulator >= twoPi * 2.0) {
                g_App.phaseAccumulator -= twoPi * 2.0;
            }
            buffer[i * 2 + 0] = (short)(wave * g_App.smoothedLeftGain);
            buffer[i * 2 + 1] = (short)(wave * g_App.smoothedRightGain);
        }
        return;
    }

    for (int i = 0; i < numFrames; ++i) {
        g_App.smoothedLeftGain  += 0.005f * (targetLeftGain  - g_App.smoothedLeftGain);
        g_App.smoothedRightGain += 0.005f * (targetRightGain - g_App.smoothedRightGain);

        if (g_App.speakerMode == SPK_MODE_SWEEP) {
            g_App.sweepProgress += 1.0 / (AUDIO_SAMPLE_RATE * 8.0);
            if (g_App.sweepProgress > 1.0) {
                g_App.sweepProgress = 0.0;
            }
            g_App.currentFreqHz = g_App.sweepStartHz * pow(g_App.sweepEndHz / g_App.sweepStartHz, g_App.sweepProgress);
            g_App.smoothedFreqHz = g_App.currentFreqHz;
        } else {
            g_App.currentFreqHz = g_App.fixedFreqHz;
            g_App.smoothedFreqHz += 0.004 * (g_App.fixedFreqHz - g_App.smoothedFreqHz);
        }

        double sample = sin(g_App.phaseAccumulator) * 24000.0;
        g_App.phaseAccumulator += twoPi * g_App.smoothedFreqHz / (double)AUDIO_SAMPLE_RATE;
        if (g_App.phaseAccumulator >= twoPi) {
            g_App.phaseAccumulator -= twoPi;
        }

        buffer[i * 2 + 0] = (short)(sample * g_App.smoothedLeftGain);
        buffer[i * 2 + 1] = (short)(sample * g_App.smoothedRightGain);
    }
}

void InitAudioEngine(HWND hwnd) {
    WAVEFORMATEX wfx = {};
    wfx.wFormatTag = WAVE_FORMAT_PCM;
    wfx.nChannels = 2;
    wfx.nSamplesPerSec = AUDIO_SAMPLE_RATE;
    wfx.wBitsPerSample = 16;
    wfx.nBlockAlign = (wfx.nChannels * wfx.wBitsPerSample) / 8;
    wfx.nAvgBytesPerSec = wfx.nSamplesPerSec * wfx.nBlockAlign;

    if (waveOutOpen(&g_App.hWaveOut, WAVE_MAPPER, &wfx, (DWORD_PTR)hwnd, 0, CALLBACK_WINDOW) == MMSYSERR_NOERROR) {
        for (int i = 0; i < AUDIO_NUM_BUFFERS; ++i) {
            memset(g_App.waveBuffers[i], 0, sizeof(g_App.waveBuffers[i]));
            memset(&g_App.waveHeaders[i], 0, sizeof(WAVEHDR));
            g_App.waveHeaders[i].lpData = (LPSTR)g_App.waveBuffers[i];
            g_App.waveHeaders[i].dwBufferLength = AUDIO_BUFFER_SAMPLES * 2 * sizeof(short);
            waveOutPrepareHeader(g_App.hWaveOut, &g_App.waveHeaders[i], sizeof(WAVEHDR));
        }
    }
}

static void ExtractCleanDeviceDesc(const wchar_t* rawDesc, wchar_t* outBuf, size_t maxLen) {
    if (!rawDesc || !rawDesc[0]) return;
    const wchar_t* semi = wcsrchr(rawDesc, L';');
    const wchar_t* clean = semi ? (semi + 1) : rawDesc;
    while (*clean == L' ' || *clean == L'\t') clean++;
    wcsncpy(outBuf, clean, maxLen - 1);
    outBuf[maxLen - 1] = L'\0';
    size_t len = wcslen(outBuf);
    while (len > 0 && (outBuf[len - 1] == L' ' || outBuf[len - 1] == L'\t' || outBuf[len - 1] == L'\r' || outBuf[len - 1] == L'\n')) {
        outBuf[--len] = L'\0';
    }
}

static bool ContainsCaseInsensitive(const wchar_t* haystack, const wchar_t* needle) {
    if (!haystack || !needle || !needle[0]) return false;
    size_t hLen = wcslen(haystack);
    size_t nLen = wcslen(needle);
    if (nLen > hLen) return false;
    for (size_t i = 0; i <= hLen - nLen; ++i) {
        bool match = true;
        for (size_t j = 0; j < nLen; ++j) {
            wchar_t c1 = haystack[i + j];
            wchar_t c2 = needle[j];
            if (c1 >= L'A' && c1 <= L'Z') c1 += (L'a' - L'A');
            if (c2 >= L'A' && c2 <= L'Z') c2 += (L'a' - L'A');
            if (c1 != c2) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

static bool IsGenericInboxDeviceName(const wchar_t* name) {
    if (!name || !name[0]) return true;
    if (name[0] == L'@' || name[0] == L'{') return true;
    if (wcslen(name) < 2) return true;

    static const wchar_t* const kGenericPatterns[] = {
        L"hid-compliant",
        L"hid keyboard",
        L"hid mouse",
        L"usb input device",
        L"usb composite device",
        L"usb human interface",
        L"generic usb hub",
        L"usb root hub",
        L"bluetooth le generic attribute",
        L"bluetooth hid device",
        L"bluetoothhiddevice",
        L"generic bluetooth",
        L"microsoft bluetooth",
        L"standard ps/2",
        L"pc/at enhanced ps/2",
        L"ps/2 compatible",
        L"microsoft ps/2",
        L"terminal server",
        L"remote desktop",
        L"system keyboard",
        L"system mouse",
        L"virtual hid",
        L"i2c hid device",
        L"gpio",
        L"convertibility"
    };
    for (size_t i = 0; i < sizeof(kGenericPatterns) / sizeof(kGenericPatterns[0]); ++i) {
        if (ContainsCaseInsensitive(name, kGenericPatterns[i])) {
            return true;
        }
    }
    return false;
}

struct WinDevPropKey {
    GUID fmtid;
    ULONG pid;
};

typedef DWORD WIN_DEVINST;
typedef DWORD WIN_CONFIGRET;
typedef ULONG WIN_DEVPROPTYPE;

typedef WIN_CONFIGRET(WINAPI* PFN_CM_Locate_DevNodeW)(WIN_DEVINST* pdnDevInst, LPCWSTR pDeviceID, ULONG ulFlags);
typedef WIN_CONFIGRET(WINAPI* PFN_CM_Get_Parent)(WIN_DEVINST* pdnDevInst, WIN_DEVINST dnDevInst, ULONG ulFlags);
typedef WIN_CONFIGRET(WINAPI* PFN_CM_Get_Child)(WIN_DEVINST* pdnDevInst, WIN_DEVINST dnDevInst, ULONG ulFlags);
typedef WIN_CONFIGRET(WINAPI* PFN_CM_Get_Sibling)(WIN_DEVINST* pdnDevInst, WIN_DEVINST dnDevInst, ULONG ulFlags);
typedef WIN_CONFIGRET(WINAPI* PFN_CM_Get_DevNode_PropertyW)(WIN_DEVINST dnDevInst, const WinDevPropKey* PropertyKey, WIN_DEVPROPTYPE* PropertyType, PBYTE PropertyBuffer, PULONG PropertyBufferSize, ULONG ulFlags);
typedef BOOLEAN(WINAPI* PFN_HidD_GetProductString)(HANDLE HidDeviceObject, PVOID Buffer, ULONG BufferLength);

static bool QueryDevNodeStringProp(PFN_CM_Get_DevNode_PropertyW pGetProp, WIN_DEVINST devInst, const WinDevPropKey& key, wchar_t* outBuf, size_t maxLen) {
    if (!pGetProp || !devInst) return false;
    BYTE rawBuf[512] = {};
    ULONG bufSize = sizeof(rawBuf);
    WIN_DEVPROPTYPE propType = 0;
    if (pGetProp(devInst, &key, &propType, rawBuf, &bufSize, 0) == 0 && (propType == 0x00000012 || propType == 0x00002012) && bufSize >= sizeof(wchar_t)) {
        const wchar_t* strVal = (const wchar_t*)rawBuf;
        if (strVal[0]) {
            ExtractCleanDeviceDesc(strVal, outBuf, maxLen);
            return outBuf[0] != L'\0';
        }
    }
    return false;
}

// Resolves the exact device name shown in Windows Settings -> Bluetooth & other devices
static bool ResolveRawDeviceNameFromPath(const wchar_t* devPath, DWORD dwRimType, wchar_t* outName, size_t maxLen, int* outScore = NULL) {
    if (outScore) *outScore = 0;
    if (!devPath || wcslen(devPath) < 8) return false;
    if (ContainsCaseInsensitive(devPath, L"RDP_") || ContainsCaseInsensitive(devPath, L"ROOT#")) return false;

    const wchar_t* p = devPath;
    if (wcsncmp(p, L"\\\\?\\", 4) == 0 || wcsncmp(p, L"\\??\\", 4) == 0) p += 4;

    wchar_t instanceId[512] = {};
    size_t instIdx = 0;
    while (*p && !(p[0] == L'#' && p[1] == L'{') && instIdx < 500) {
        instanceId[instIdx++] = (*p == L'#') ? L'\\' : *p;
        p++;
    }
    instanceId[instIdx] = L'\0';

    bool isAcpiPs2 = ContainsCaseInsensitive(instanceId, L"ACPI\\") || ContainsCaseInsensitive(instanceId, L"PNP03") || ContainsCaseInsensitive(instanceId, L"PNP0F");
    bool isPrimaryInterface = !ContainsCaseInsensitive(instanceId, L"MI_01") &&
                              !ContainsCaseInsensitive(instanceId, L"MI_02") &&
                              !ContainsCaseInsensitive(instanceId, L"MI_03") &&
                              !ContainsCaseInsensitive(instanceId, L"Col02") &&
                              !ContainsCaseInsensitive(instanceId, L"Col03") &&
                              !ContainsCaseInsensitive(instanceId, L"Col04");

    // Property keys used by Windows Settings -> Bluetooth & devices (DeviceContainers + PnP DevNode)
    static const WinDevPropKey KEY_ContainerFriendlyName = { { 0x656A3BB3, 0xECC0, 0x43FD, { 0x84, 0x77, 0x4A, 0xE0, 0x40, 0x4A, 0x96, 0xCD } }, 12288 };
    static const WinDevPropKey KEY_ContainerModelName    = { { 0x656A3BB3, 0xECC0, 0x43FD, { 0x84, 0x77, 0x4A, 0xE0, 0x40, 0x4A, 0x96, 0xCD } }, 8194 };
    static const WinDevPropKey KEY_ContainerDesc1        = { { 0x78C34FC8, 0x104A, 0x4ACA, { 0x9E, 0xA4, 0x52, 0x4D, 0x52, 0x99, 0x6E, 0x57 } }, 81 };
    static const WinDevPropKey KEY_DeviceModel           = { { 0x78C34FC8, 0x104A, 0x4ACA, { 0x9E, 0xA4, 0x52, 0x4D, 0x52, 0x99, 0x6E, 0x57 } }, 39 };
    static const WinDevPropKey KEY_FriendlyName          = { { 0xA45C254E, 0xDF1C, 0x4EFD, { 0x80, 0x20, 0x67, 0xD1, 0x46, 0xA8, 0x50, 0xE0 } }, 14 };
    static const WinDevPropKey KEY_BusReportedDesc       = { { 0x540B947E, 0x8B40, 0x45BC, { 0xA8, 0xA2, 0x6A, 0x0B, 0x89, 0x4C, 0xBD, 0xA2 } }, 4 };
    static const WinDevPropKey KEY_Name                  = { { 0xB725F130, 0x47EF, 0x101A, { 0xA5, 0xF1, 0x02, 0x60, 0x8C, 0x9E, 0xEB, 0xAC } }, 10 };
    static const WinDevPropKey KEY_DeviceDesc            = { { 0xA45C254E, 0xDF1C, 0x4EFD, { 0x80, 0x20, 0x67, 0xD1, 0x46, 0xA8, 0x50, 0xE0 } }, 2 };
    static const WinDevPropKey KEY_PrimaryCategory       = { { 0x78C34FC8, 0x104A, 0x4ACA, { 0x9E, 0xA4, 0x52, 0x4D, 0x52, 0x99, 0x6E, 0x57 } }, 97 };

    wchar_t bestSpecific[128] = {};
    wchar_t bestFallback[128] = {};
    wchar_t primaryCategory[64] = {};

    // 1. Walk PnP DevNode & Parent Composite/Bluetooth hierarchy via cfgmgr32.dll
    static HMODULE hCfgMgr = LoadLibraryW(L"cfgmgr32.dll");
    static PFN_CM_Locate_DevNodeW pLocate = hCfgMgr ? (PFN_CM_Locate_DevNodeW)GetProcAddress(hCfgMgr, "CM_Locate_DevNodeW") : NULL;
    static PFN_CM_Get_Parent pGetParent = hCfgMgr ? (PFN_CM_Get_Parent)GetProcAddress(hCfgMgr, "CM_Get_Parent") : NULL;
    static PFN_CM_Get_Child pGetChild = hCfgMgr ? (PFN_CM_Get_Child)GetProcAddress(hCfgMgr, "CM_Get_Child") : NULL;
    static PFN_CM_Get_Sibling pGetSibling = hCfgMgr ? (PFN_CM_Get_Sibling)GetProcAddress(hCfgMgr, "CM_Get_Sibling") : NULL;
    static PFN_CM_Get_DevNode_PropertyW pGetProp = hCfgMgr ? (PFN_CM_Get_DevNode_PropertyW)GetProcAddress(hCfgMgr, "CM_Get_DevNode_PropertyW") : NULL;

    if (pLocate && pGetProp) {
        WIN_DEVINST devInst = 0;
        if (pLocate(&devInst, instanceId, 0) == 0 && devInst != 0) {
            const WinDevPropKey priorityKeys[] = {
                KEY_ContainerFriendlyName,
                KEY_ContainerModelName,
                KEY_ContainerDesc1,
                KEY_DeviceModel,
                KEY_FriendlyName,
                KEY_BusReportedDesc,
                KEY_Name,
                KEY_DeviceDesc
            };

            auto checkNodeProps = [&](WIN_DEVINST node) {
                if (!primaryCategory[0]) {
                    QueryDevNodeStringProp(pGetProp, node, KEY_PrimaryCategory, primaryCategory, 64);
                }
                for (size_t k = 0; k < sizeof(priorityKeys) / sizeof(priorityKeys[0]); ++k) {
                    wchar_t candidate[128] = {};
                    if (QueryDevNodeStringProp(pGetProp, node, priorityKeys[k], candidate, 128)) {
                        if (!IsGenericInboxDeviceName(candidate)) {
                            if (!bestSpecific[0]) {
                                wcsncpy(bestSpecific, candidate, 127);
                                return true;
                            }
                        } else if (!bestFallback[0]) {
                            wcsncpy(bestFallback, candidate, 127);
                        }
                    }
                }
                return false;
            };

            WIN_DEVINST currInst = devInst;
            for (int depth = 0; depth < 5 && currInst != 0; ++depth) {
                if (checkNodeProps(currInst)) break;

                // At parent levels (USB composite or Bluetooth LE device), also check immediate sibling services (e.g. BLE GAP service)
                if (depth >= 1 && depth <= 2 && pGetChild && pGetSibling) {
                    WIN_DEVINST childInst = 0;
                    if (pGetChild(&childInst, currInst, 0) == 0 && childInst != 0) {
                        int sibCount = 0;
                        while (childInst != 0 && sibCount < 12) {
                            if (checkNodeProps(childInst)) break;
                            WIN_DEVINST nextSib = 0;
                            if (pGetSibling(&nextSib, childInst, 0) != 0) break;
                            childInst = nextSib;
                            sibCount++;
                        }
                        if (bestSpecific[0]) break;
                    }
                }

                WIN_DEVINST parentInst = 0;
                if (!pGetParent || pGetParent(&parentInst, currInst, 0) != 0) break;
                currInst = parentInst;
            }
        }
    }

    // 2. Query HID Firmware Product String directly via hid.dll (HidD_GetProductString)
    if (!bestSpecific[0]) {
        static HMODULE hHid = LoadLibraryW(L"hid.dll");
        static PFN_HidD_GetProductString pGetProdStr = hHid ? (PFN_HidD_GetProductString)GetProcAddress(hHid, "HidD_GetProductString") : NULL;
        if (pGetProdStr) {
            HANDLE hDeviceFile = CreateFileW(devPath, 0, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
            if (hDeviceFile != INVALID_HANDLE_VALUE) {
                wchar_t hidProd[128] = {};
                if (pGetProdStr(hDeviceFile, hidProd, sizeof(hidProd)) && hidProd[0]) {
                    wchar_t cleanProd[128] = {};
                    ExtractCleanDeviceDesc(hidProd, cleanProd, 128);
                    if (!IsGenericInboxDeviceName(cleanProd)) {
                        wcsncpy(bestSpecific, cleanProd, 127);
                    } else if (!bestFallback[0] && cleanProd[0]) {
                        wcsncpy(bestFallback, cleanProd, 127);
                    }
                }
                CloseHandle(hDeviceFile);
            }
        }
    }

    // 3. Fallback to Registry Enum FriendlyName / DeviceDesc
    if (!bestSpecific[0] && !bestFallback[0]) {
        wchar_t subKey[560];
        swprintf(subKey, 560, L"SYSTEM\\CurrentControlSet\\Enum\\%s", instanceId);
        HKEY hKey = NULL;
        if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, subKey, 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            wchar_t valBuf[256] = {};
            DWORD cb = sizeof(valBuf);
            DWORD type = 0;
            if (RegQueryValueExW(hKey, L"FriendlyName", NULL, &type, (LPBYTE)valBuf, &cb) == ERROR_SUCCESS && valBuf[0]) {
                wchar_t cleaned[128] = {};
                ExtractCleanDeviceDesc(valBuf, cleaned, 128);
                if (!IsGenericInboxDeviceName(cleaned)) wcsncpy(bestSpecific, cleaned, 127);
                else wcsncpy(bestFallback, cleaned, 127);
            }
            cb = sizeof(valBuf);
            if (!bestSpecific[0] && !bestFallback[0] && RegQueryValueExW(hKey, L"DeviceDesc", NULL, &type, (LPBYTE)valBuf, &cb) == ERROR_SUCCESS && valBuf[0]) {
                wchar_t cleaned[128] = {};
                ExtractCleanDeviceDesc(valBuf, cleaned, 128);
                if (!IsGenericInboxDeviceName(cleaned)) wcsncpy(bestSpecific, cleaned, 127);
                else wcsncpy(bestFallback, cleaned, 127);
            }
            RegCloseKey(hKey);
        }
    }

    const wchar_t* chosen = bestSpecific[0] ? bestSpecific : bestFallback;
    if (!chosen[0]) return false;

    wcsncpy(outName, chosen, maxLen - 1);
    outName[maxLen - 1] = L'\0';

    int score = bestSpecific[0] ? 100 : (isAcpiPs2 ? 10 : 25);
    if (isPrimaryInterface) score += 20;

    bool nameHasMouse = ContainsCaseInsensitive(outName, L"mouse") ||
                        ContainsCaseInsensitive(outName, L"deathadder") ||
                        ContainsCaseInsensitive(outName, L"viper") ||
                        ContainsCaseInsensitive(outName, L"basilisk") ||
                        ContainsCaseInsensitive(outName, L"superlight") ||
                        ContainsCaseInsensitive(outName, L"mx master") ||
                        ContainsCaseInsensitive(outName, L"mx anywhere") ||
                        ContainsCaseInsensitive(outName, L"trackball") ||
                        ContainsCaseInsensitive(outName, L"touchpad") ||
                        ContainsCaseInsensitive(primaryCategory, L"Mouse");

    bool nameHasKeyboard = ContainsCaseInsensitive(outName, L"keyboard") ||
                           ContainsCaseInsensitive(outName, L"keychron") ||
                           ContainsCaseInsensitive(outName, L"huntsman") ||
                           ContainsCaseInsensitive(outName, L"blackwidow") ||
                           ContainsCaseInsensitive(outName, L"wooting") ||
                           ContainsCaseInsensitive(outName, L"akko") ||
                           ContainsCaseInsensitive(outName, L"ducky") ||
                           ContainsCaseInsensitive(outName, L"nuphy") ||
                           ContainsCaseInsensitive(primaryCategory, L"Keyboard");

    if (dwRimType == RIM_TYPEMOUSE) {
        if (nameHasMouse) score += 35;
        if (nameHasKeyboard && !nameHasMouse) score -= 50;
    } else if (dwRimType == RIM_TYPEKEYBOARD) {
        if (nameHasKeyboard) score += 35;
        if (nameHasMouse && !nameHasKeyboard) score -= 50;
    }

    if (outScore) *outScore = score;
    return true;
}

void DetectHardwareDeviceNames(HWND hwnd) {
    wcscpy(g_App.mouseDeviceName, L"HID-Compliant Mouse");
    wcscpy(g_App.keyboardDeviceName, L"HID Keyboard Device");
    wcscpy(g_App.speakerDeviceName, L"Default Windows Audio Output");
    g_App.mouseDeviceScore = 0;
    g_App.keyboardDeviceScore = 0;

    WAVEOUTCAPSW woc = {};
    if (waveOutGetDevCapsW(WAVE_MAPPER, &woc, sizeof(woc)) == MMSYSERR_NOERROR && woc.szPname[0] &&
        !ContainsCaseInsensitive(woc.szPname, L"Sound Mapper")) {
        wcsncpy(g_App.speakerDeviceName, woc.szPname, 127);
        g_App.speakerDeviceName[127] = L'\0';
    } else if (waveOutGetNumDevs() > 0 && waveOutGetDevCapsW(0, &woc, sizeof(woc)) == MMSYSERR_NOERROR && woc.szPname[0]) {
        wcsncpy(g_App.speakerDeviceName, woc.szPname, 127);
        g_App.speakerDeviceName[127] = L'\0';
    }

    UINT numDevices = 0;
    if (GetRawInputDeviceList(NULL, &numDevices, sizeof(RAWINPUTDEVICELIST)) == 0 && numDevices > 0) {
        RAWINPUTDEVICELIST* pList = (RAWINPUTDEVICELIST*)HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, sizeof(RAWINPUTDEVICELIST) * numDevices);
        if (pList) {
            if (GetRawInputDeviceList(pList, &numDevices, sizeof(RAWINPUTDEVICELIST)) != (UINT)-1) {
                for (UINT i = 0; i < numDevices; ++i) {
                    if (pList[i].dwType != RIM_TYPEMOUSE && pList[i].dwType != RIM_TYPEKEYBOARD) continue;
                    UINT nameLen = 0;
                    if (GetRawInputDeviceInfoW(pList[i].hDevice, RIDI_DEVICENAME, NULL, &nameLen) == 0 && nameLen > 0 && nameLen < 512) {
                        wchar_t pathBuf[512] = {};
                        if (GetRawInputDeviceInfoW(pList[i].hDevice, RIDI_DEVICENAME, pathBuf, &nameLen) != (UINT)-1) {
                            wchar_t resolved[128] = {};
                            int score = 0;
                            if (ResolveRawDeviceNameFromPath(pathBuf, pList[i].dwType, resolved, 128, &score)) {
                                if (pList[i].dwType == RIM_TYPEMOUSE) {
                                    if (score > g_App.mouseDeviceScore) {
                                        g_App.mouseDeviceScore = score;
                                        wcsncpy(g_App.mouseDeviceName, resolved, 127);
                                        g_App.mouseDeviceName[127] = L'\0';
                                    }
                                } else if (pList[i].dwType == RIM_TYPEKEYBOARD) {
                                    if (score > g_App.keyboardDeviceScore) {
                                        g_App.keyboardDeviceScore = score;
                                        wcsncpy(g_App.keyboardDeviceName, resolved, 127);
                                        g_App.keyboardDeviceName[127] = L'\0';
                                    }
                                }
                            }
                        }
                    }
                }
            }
            HeapFree(GetProcessHeap(), 0, pList);
        }
    }

    RAWINPUTDEVICE rids[2] = {};
    rids[0].usUsagePage = 0x01;
    rids[0].usUsage     = 0x02; // Mouse
    rids[0].dwFlags     = RIDEV_INPUTSINK;
    rids[0].hwndTarget  = hwnd;
    rids[1].usUsagePage = 0x01;
    rids[1].usUsage     = 0x06; // Keyboard
    rids[1].dwFlags     = RIDEV_INPUTSINK;
    rids[1].hwndTarget  = hwnd;
    RegisterRawInputDevices(rids, 2, sizeof(RAWINPUTDEVICE));
}

void StartAudioPlayback() {
    if (!g_App.hWaveOut || g_App.speakerPlaying) return;
    g_App.speakerPlaying = true;
    for (int i = 0; i < AUDIO_NUM_BUFFERS; ++i) {
        FillAudioBuffer(g_App.waveBuffers[i], AUDIO_BUFFER_SAMPLES);
        waveOutWrite(g_App.hWaveOut, &g_App.waveHeaders[i], sizeof(WAVEHDR));
    }
}

void StopAudioPlayback() {
    if (!g_App.hWaveOut || !g_App.speakerPlaying) return;
    g_App.speakerPlaying = false;
    waveOutReset(g_App.hWaveOut);
}

void ShutdownAudioEngine() {
    StopAudioPlayback();
    if (g_App.hWaveOut) {
        for (int i = 0; i < AUDIO_NUM_BUFFERS; ++i) {
            waveOutUnprepareHeader(g_App.hWaveOut, &g_App.waveHeaders[i], sizeof(WAVEHDR));
        }
        waveOutClose(g_App.hWaveOut);
        g_App.hWaveOut = NULL;
    }
}

// ============================================================================
// Low-Level Input Hooks (Keyboard & Mouse Blocking + Shortcut Prevention)
// ============================================================================
const wchar_t* GetReadableKeyName(UINT vk, UINT scanCode, bool isExtended) {
    if (vk == VK_NUMPAD_ENTER_SYNTH) return L"NumEnter";
    for (int i = 0; i < g_KeyCount; ++i) {
        if (g_KeyboardLayout[i].vk == vk) {
            return g_KeyboardLayout[i].label;
        }
    }
    static wchar_t buf[64];
    LONG lParam = (scanCode << 16) | (isExtended ? (1 << 24) : 0);
    if (GetKeyNameTextW(lParam, buf, 64) > 0) {
        return buf;
    }
    swprintf(buf, 64, L"VK_0x%02X", vk);
    return buf;
}

static UINT ScanCodeToPhysicalVk(UINT scanCode, bool isExt) {
    UINT sc = scanCode & 0x7F;
    if (isExt) {
        switch (sc) {
        case 0x1C: return VK_NUMPAD_ENTER_SYNTH;
        case 0x1D: return VK_RCONTROL;
        case 0x35: return VK_DIVIDE;
        case 0x37: return VK_SNAPSHOT;
        case 0x38: return VK_RMENU;
        case 0x45: return VK_NUMLOCK;
        case 0x46: return VK_PAUSE;
        case 0x47: return VK_HOME;
        case 0x48: return VK_UP;
        case 0x49: return VK_PRIOR;
        case 0x4B: return VK_LEFT;
        case 0x4D: return VK_RIGHT;
        case 0x4F: return VK_END;
        case 0x50: return VK_DOWN;
        case 0x51: return VK_NEXT;
        case 0x52: return VK_INSERT;
        case 0x53: return VK_DELETE;
        case 0x5B: return VK_LWIN;
        case 0x5C: return VK_RWIN;
        case 0x5D: return VK_APPS;
        }
    } else {
        switch (sc) {
        case 0x01: return VK_ESCAPE;
        case 0x02: return '1';
        case 0x03: return '2';
        case 0x04: return '3';
        case 0x05: return '4';
        case 0x06: return '5';
        case 0x07: return '6';
        case 0x08: return '7';
        case 0x09: return '8';
        case 0x0A: return '9';
        case 0x0B: return '0';
        case 0x0C: return VK_OEM_MINUS;
        case 0x0D: return VK_OEM_PLUS;
        case 0x0E: return VK_BACK;
        case 0x0F: return VK_TAB;
        case 0x10: return 'Q';
        case 0x11: return 'W';
        case 0x12: return 'E';
        case 0x13: return 'R';
        case 0x14: return 'T';
        case 0x15: return 'Y';
        case 0x16: return 'U';
        case 0x17: return 'I';
        case 0x18: return 'O';
        case 0x19: return 'P';
        case 0x1A: return VK_OEM_4;
        case 0x1B: return VK_OEM_6;
        case 0x1C: return VK_RETURN;
        case 0x1D: return VK_LCONTROL;
        case 0x1E: return 'A';
        case 0x1F: return 'S';
        case 0x20: return 'D';
        case 0x21: return 'F';
        case 0x22: return 'G';
        case 0x23: return 'H';
        case 0x24: return 'J';
        case 0x25: return 'K';
        case 0x26: return 'L';
        case 0x27: return VK_OEM_1;
        case 0x28: return VK_OEM_7;
        case 0x29: return VK_OEM_3;
        case 0x2A: return VK_LSHIFT;
        case 0x2B: return VK_OEM_5;
        case 0x2C: return 'Z';
        case 0x2D: return 'X';
        case 0x2E: return 'C';
        case 0x2F: return 'V';
        case 0x30: return 'B';
        case 0x31: return 'N';
        case 0x32: return 'M';
        case 0x33: return VK_OEM_COMMA;
        case 0x34: return VK_OEM_PERIOD;
        case 0x35: return VK_OEM_2;
        case 0x36: return VK_RSHIFT;
        case 0x37: return VK_MULTIPLY;
        case 0x38: return VK_LMENU;
        case 0x39: return VK_SPACE;
        case 0x3A: return VK_CAPITAL;
        case 0x3B: return VK_F1;
        case 0x3C: return VK_F2;
        case 0x3D: return VK_F3;
        case 0x3E: return VK_F4;
        case 0x3F: return VK_F5;
        case 0x40: return VK_F6;
        case 0x41: return VK_F7;
        case 0x42: return VK_F8;
        case 0x43: return VK_F9;
        case 0x44: return VK_F10;
        case 0x45: return VK_PAUSE;
        case 0x46: return VK_SCROLL;
        case 0x47: return VK_NUMPAD7;
        case 0x48: return VK_NUMPAD8;
        case 0x49: return VK_NUMPAD9;
        case 0x4A: return VK_SUBTRACT;
        case 0x4B: return VK_NUMPAD4;
        case 0x4C: return VK_NUMPAD5;
        case 0x4D: return VK_NUMPAD6;
        case 0x4E: return VK_ADD;
        case 0x4F: return VK_NUMPAD1;
        case 0x50: return VK_NUMPAD2;
        case 0x51: return VK_NUMPAD3;
        case 0x52: return VK_NUMPAD0;
        case 0x53: return VK_DECIMAL;
        case 0x54: return VK_SNAPSHOT;
        case 0x57: return VK_F11;
        case 0x58: return VK_F12;
        }
    }
    return 0;
}

static bool IsVkInKeyboardLayout(UINT vk) {
    if (vk == 0 || vk >= 256) return false;
    for (int i = 0; i < g_KeyCount; ++i) {
        if (g_KeyboardLayout[i].vk == vk) return true;
    }
    return false;
}

static UINT NormalizePhysicalVk(UINT vk, UINT scanCode, bool isExt) {
    if (vk == VK_RETURN && isExt) {
        return VK_NUMPAD_ENTER_SYNTH;
    }
    if (vk == VK_SHIFT || vk == VK_LSHIFT || vk == VK_RSHIFT) {
        if ((scanCode & 0x7F) == 0x36) return VK_RSHIFT;
        if ((scanCode & 0x7F) == 0x2A) return VK_LSHIFT;
        return (vk == VK_RSHIFT) ? VK_RSHIFT : VK_LSHIFT;
    }
    if (vk == VK_CONTROL || vk == VK_LCONTROL || vk == VK_RCONTROL) {
        if (vk == VK_RCONTROL || isExt) return VK_RCONTROL;
        return VK_LCONTROL;
    }
    if (vk == VK_MENU || vk == VK_LMENU || vk == VK_RMENU) {
        if (vk == VK_RMENU || isExt) return VK_RMENU;
        return VK_LMENU;
    }

    // If NumLock is OFF, non-extended Numpad keys report navigation VKs; map them to Numpad VKs so Numpad keys light up
    if (!isExt && (scanCode & 0x7F) >= 0x47 && (scanCode & 0x7F) <= 0x53) {
        UINT bySc = ScanCodeToPhysicalVk(scanCode, false);
        if (bySc != 0) return bySc;
    }

    // Recover physical VK from hardware scan code when IME sets VK_PROCESSKEY (0xE5) or non-ANSI VK
    if (!IsVkInKeyboardLayout(vk) && scanCode != 0) {
        UINT bySc = ScanCodeToPhysicalVk(scanCode, isExt);
        if (bySc != 0) return bySc;
        UINT mapped = MapVirtualKeyW(scanCode & 0x7F, MAPVK_VSC_TO_VK_EX);
        if (mapped == 0) mapped = MapVirtualKeyW(scanCode & 0x7F, MAPVK_VSC_TO_VK);
        if (IsVkInKeyboardLayout(mapped)) return mapped;
    }

    return vk;
}

static bool ProcessPhysicalKeyEvent(UINT rawVk, UINT scanCode, bool isExt, bool isDown, bool isUp, bool allowWhenTabActive) {
    if (rawVk == 0xFF && scanCode == 0) return false;
    UINT vk = NormalizePhysicalVk(rawVk, scanCode, isExt);

    // Shortcut: Press Space 5 times to enable mouse and keyboard
    if (vk == VK_SPACE) {
        if (isDown && !g_App.spacePhysDown) {
            g_App.spacePhysDown = true;
            DWORD nowTick = GetTickCount();
            if (nowTick - g_App.lastSpaceTick > 2500) {
                g_App.spacePressCount = 1;
            } else {
                g_App.spacePressCount++;
            }
            g_App.lastSpaceTick = nowTick;

            if (g_App.spacePressCount >= 5 && (g_App.disableKeyboard || g_App.disableMouse)) {
                g_App.disableKeyboard = false;
                g_App.disableMouse = false;
                g_App.spacePressCount = 0;
                ClipCursor(NULL);
                InvalidateRect(g_App.hwnd, NULL, FALSE);
                return true;
            }
        } else if (isUp) {
            g_App.spacePhysDown = false;
        }
    } else if (isDown && vk != 0) {
        g_App.spacePressCount = 0;
    }

    if (g_App.disableKeyboard) {
        return true;
    }

    bool windowVisible = g_App.hwnd && !IsIconic(g_App.hwnd);
    if ((allowWhenTabActive || windowVisible) && g_App.currentTab == TAB_KEYBOARD && vk > 0 && vk < 256) {
        if (isDown) {
            bool changed = false;
            if (!g_App.keyCurrentlyDown[vk]) {
                g_App.totalKeyPresses++;
                g_App.keyCurrentlyDown[vk] = true;
                changed = true;
            }
            if (!g_App.keyLatched[vk]) {
                g_App.keyLatched[vk] = true;
                changed = true;
            }
            if (g_App.lastVkCode != vk) {
                changed = true;
            }
            g_App.lastVkCode = vk;
            g_App.lastScanCode = scanCode;
            wcsncpy(g_App.lastKeyLabel, GetReadableKeyName(vk, scanCode, isExt), 63);
            g_App.lastKeyLabel[63] = L'\0';
            RecalculateRollover();
            if (changed) {
                InvalidateRect(g_App.hwnd, NULL, FALSE);
            }
        } else if (isUp) {
            if (g_App.keyCurrentlyDown[vk]) {
                g_App.keyCurrentlyDown[vk] = false;
                RecalculateRollover();
                InvalidateRect(g_App.hwnd, NULL, FALSE);
            }
        }
    }
    return false;
}

static bool IsAppWindowActive() {
    if (!g_App.hwnd) return false;
    HWND fg = GetForegroundWindow();
    if (fg == g_App.hwnd) return true;
    if (fg && GetWindowThreadProcessId(fg, NULL) == GetCurrentThreadId()) return true;
    return (GetActiveWindow() == g_App.hwnd);
}

LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION) {
        KBDLLHOOKSTRUCT* pKey = (KBDLLHOOKSTRUCT*)lParam;
        bool isDown = (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN);
        bool isUp   = (wParam == WM_KEYUP   || wParam == WM_SYSKEYUP);
        bool isExt  = (pKey->flags & LLKHF_EXTENDED) != 0;
        bool active = IsAppWindowActive();

        if (ProcessPhysicalKeyEvent(pKey->vkCode, pKey->scanCode, isExt, isDown, isUp, active)) {
            return 1;
        }
        if (active && g_App.currentTab == TAB_KEYBOARD && g_App.blockWinShortcuts) {
            return 1;
        }
    }
    return CallNextHookEx(g_hKeyboardHook, nCode, wParam, lParam);
}

LRESULT CALLBACK LowLevelMouseProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION) {
        if (g_App.disableMouse) {
            return 1;
        }
    }
    return CallNextHookEx(g_hMouseHook, nCode, wParam, lParam);
}

// ============================================================================
// Mouse Diagnostic Logic (Double-Click Bounce & Scroll Progression Graph)
// ============================================================================
void RecordMouseButtonEvent(int btnIndex, const wchar_t* btnName, bool isDown) {
    if (btnIndex < 0 || btnIndex >= 5) return;
    g_App.mouseBtnDown[btnIndex] = isDown;

    if (isDown) {
        LARGE_INTEGER now;
        QueryPerformanceCounter(&now);
        g_App.mouseClickCount[btnIndex]++;

        if (g_App.lastClickTick[btnIndex] != 0) {
            double deltaMs = (double)(now.QuadPart - g_App.lastClickTick[btnIndex]) * 1000.0 / (double)g_App.qpcFreq;
            g_App.lastClickDeltaMs[btnIndex] = deltaMs;

            wchar_t logLine[128];
            bool isFault = (deltaMs < g_App.doubleClickThresholdMs);
            if (isFault) {
                g_App.mouseDoubleClickFaults[btnIndex]++;
                swprintf(logLine, 128, L"[FAULT] %s bounce: %.1f ms (< %.0f ms)", btnName, deltaMs, g_App.doubleClickThresholdMs);
            } else {
                swprintf(logLine, 128, L"[OK] %s interval: %.1f ms", btnName, deltaMs);
            }
            PushMouseLog(logLine, isFault);
        } else {
            wchar_t logLine[128];
            swprintf(logLine, 128, L"[OK] %s initial click registered", btnName);
            PushMouseLog(logLine, false);
        }
        g_App.lastClickTick[btnIndex] = now.QuadPart;
    }
    InvalidateRect(g_App.hwnd, NULL, FALSE);
}

void RecordMouseWheelEvent(short wheelDelta) {
    LARGE_INTEGER now;
    QueryPerformanceCounter(&now);
    int dir = (wheelDelta > 0) ? 1 : -1;
    bool glitch = false;

    if (g_App.lastScrollTick != 0 && g_App.lastScrollDirection != 0) {
        double deltaMs = (double)(now.QuadPart - g_App.lastScrollTick) * 1000.0 / (double)g_App.qpcFreq;
        if (dir != g_App.lastScrollDirection && deltaMs < 55.0) {
            glitch = true;
            g_App.scrollEncoderGlitches++;
            wchar_t logLine[128];
            swprintf(logLine, 128, L"[ENCODER ERROR] Reverse jump within %.1f ms!", deltaMs);
            PushMouseLog(logLine, true);
        }
    }

    if (dir > 0) {
        g_App.scrollUpSteps++;
        g_App.scrollCumulativePos++;
    } else {
        g_App.scrollDownSteps++;
        g_App.scrollCumulativePos--;
    }

    PushScrollSample(dir, glitch ? TICK_ERROR : TICK_ANALYZING, now.QuadPart);

    g_App.lastScrollDirection = dir;
    g_App.lastScrollTick = now.QuadPart;
    InvalidateRect(g_App.hwnd, NULL, FALSE);
}

// ============================================================================
// Zero-Allocation GDI Drawing Helpers (Using DC_BRUSH & DC_PEN Stock Objects)
// ============================================================================
void DrawRoundedBox(HDC hdc, const RECT& rc, int radius, COLORREF fillColor, COLORREF borderColor, int borderWidth = 1) {
    HGDIOBJ oldBrush = SelectObject(hdc, GetStockObject(DC_BRUSH));
    SetDCBrushColor(hdc, fillColor);

    if (borderWidth <= 1) {
        HGDIOBJ oldPen = SelectObject(hdc, (borderWidth == 1) ? GetStockObject(DC_PEN) : GetStockObject(NULL_PEN));
        if (borderWidth == 1) SetDCPenColor(hdc, borderColor);
        RoundRect(hdc, rc.left, rc.top, rc.right, rc.bottom, radius, radius);
        SelectObject(hdc, oldPen);
    } else {
        HPEN hPen = CreatePen(PS_SOLID, borderWidth, borderColor);
        HGDIOBJ oldPen = SelectObject(hdc, hPen);
        RoundRect(hdc, rc.left, rc.top, rc.right, rc.bottom, radius, radius);
        SelectObject(hdc, oldPen);
        DeleteObject(hPen);
    }
    SelectObject(hdc, oldBrush);
}

void FillSolidRectFast(HDC hdc, const RECT& rc, COLORREF color) {
    COLORREF oldBk = SetBkColor(hdc, color);
    ExtTextOutW(hdc, 0, 0, ETO_OPAQUE, &rc, NULL, 0, NULL);
    SetBkColor(hdc, oldBk);
}

void DrawTextClipped(HDC hdc, const wchar_t* text, const RECT& rc, UINT flags) {
    if (rc.right <= rc.left || rc.bottom <= rc.top) return;
    int saved = SaveDC(hdc);
    IntersectClipRect(hdc, rc.left, rc.top, rc.right, rc.bottom);
    RECT drawRc = rc;
    DrawTextW(hdc, text, -1, &drawRc, flags | DT_END_ELLIPSIS);
    RestoreDC(hdc, saved);
}

void DrawButton(HDC hdc, const RECT& rc, const wchar_t* text, COLORREF bg, COLORREF fg, COLORREF border, HFONT font, int radius = 8) {
    DrawRoundedBox(hdc, rc, ScaleDPI(radius), bg, border, 1);
    HGDIOBJ oldFont = SelectObject(hdc, font);
    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, fg);
    RECT textRc = { rc.left + ScaleDPI(6), rc.top + ScaleDPI(2), rc.right - ScaleDPI(6), rc.bottom - ScaleDPI(2) };
    DrawTextClipped(hdc, text, textRc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    SelectObject(hdc, oldFont);
}

void SyncWin32TitleBarTheme(HWND hwnd, bool dark) {
    HMODULE hDwm = LoadLibraryW(L"dwmapi.dll");
    if (hDwm) {
        typedef HRESULT(WINAPI* PFN_DwmSetWindowAttribute)(HWND, DWORD, LPCVOID, DWORD);
        PFN_DwmSetWindowAttribute pfn = (PFN_DwmSetWindowAttribute)GetProcAddress(hDwm, "DwmSetWindowAttribute");
        if (pfn) {
            BOOL useDark = dark ? TRUE : FALSE;
            pfn(hwnd, 20, &useDark, sizeof(useDark));
            pfn(hwnd, 19, &useDark, sizeof(useDark));
        }
        FreeLibrary(hDwm);
    }
}

// Procedural 32-bit ARGB Keyboard Icon Generator (Zero external .ico file dependency)
HICON CreateKeyboardAppIcon(int size) {
    BITMAPV5HEADER bi = {};
    bi.bV5Size        = sizeof(BITMAPV5HEADER);
    bi.bV5Width       = size;
    bi.bV5Height      = -size; // top-down DIB
    bi.bV5Planes      = 1;
    bi.bV5BitCount    = 32;
    bi.bV5Compression = BI_BITFIELDS;
    bi.bV5RedMask     = 0x00FF0000;
    bi.bV5GreenMask   = 0x0000FF00;
    bi.bV5BlueMask    = 0x000000FF;
    bi.bV5AlphaMask   = 0xFF000000;

    HDC hdcScreen = GetDC(NULL);
    DWORD* pixels = NULL;
    HBITMAP hbmColor = CreateDIBSection(hdcScreen, (BITMAPINFO*)&bi, DIB_RGB_COLORS, (void**)&pixels, NULL, 0);
    ReleaseDC(NULL, hdcScreen);
    if (!hbmColor || !pixels) return LoadIconW(NULL, IDI_APPLICATION);

    memset(pixels, 0, size * size * sizeof(DWORD));

    auto setBox = [&](float nx0, float ny0, float nx1, float ny1, DWORD argb) {
        int x0 = (int)(nx0 * size + 0.5f);
        int y0 = (int)(ny0 * size + 0.5f);
        int x1 = (int)(nx1 * size + 0.5f);
        int y1 = (int)(ny1 * size + 0.5f);
        if (x0 < 0) x0 = 0;
        if (y0 < 0) y0 = 0;
        if (x1 > size) x1 = size;
        if (y1 > size) y1 = size;
        for (int y = y0; y < y1; ++y) {
            for (int x = x0; x < x1; ++x) {
                pixels[y * size + x] = argb;
            }
        }
    };

    // Outer keyboard bezel (#38BDF8 sky-blue accent border) & dark slate body (#0F172A)
    setBox(0.06f, 0.18f, 0.94f, 0.82f, 0xFF38BDF8);
    setBox(0.11f, 0.23f, 0.89f, 0.77f, 0xFF0F172A);

    // Row 1 keys
    setBox(0.16f, 0.30f, 0.27f, 0.41f, 0xFF38BDF8); // Active blue key
    setBox(0.31f, 0.30f, 0.42f, 0.41f, 0xFF10B981); // Latched green key
    setBox(0.46f, 0.30f, 0.57f, 0.41f, 0xFFE2E8F0);
    setBox(0.61f, 0.30f, 0.72f, 0.41f, 0xFFE2E8F0);
    setBox(0.75f, 0.30f, 0.84f, 0.41f, 0xFFE2E8F0);

    // Row 2 keys
    setBox(0.16f, 0.45f, 0.29f, 0.56f, 0xFFE2E8F0);
    setBox(0.33f, 0.45f, 0.44f, 0.56f, 0xFF10B981); // Latched green key
    setBox(0.48f, 0.45f, 0.59f, 0.56f, 0xFF38BDF8); // Active blue key
    setBox(0.63f, 0.45f, 0.84f, 0.56f, 0xFFE2E8F0);

    // Row 3 (Modifiers + Spacebar)
    setBox(0.16f, 0.60f, 0.28f, 0.71f, 0xFF94A3B8);
    setBox(0.32f, 0.60f, 0.68f, 0.71f, 0xFF38BDF8); // Spacebar
    setBox(0.72f, 0.60f, 0.84f, 0.71f, 0xFF94A3B8);

    HBITMAP hbmMask = CreateBitmap(size, size, 1, 1, NULL);
    ICONINFO ii = {};
    ii.fIcon    = TRUE;
    ii.hbmMask  = hbmMask;
    ii.hbmColor = hbmColor;
    HICON hIcon = CreateIconIndirect(&ii);

    DeleteObject(hbmColor);
    DeleteObject(hbmMask);
    return hIcon ? hIcon : LoadIconW(NULL, IDI_APPLICATION);
}

// ============================================================================
// View Renderers
// ============================================================================
void RenderKeyboardTab(HDC hdc, const RECT& clientRc, const ThemeColors& theme) {
    int pad = ScaleDPI(24);
    int topY = ScaleDPI(78);

    RECT rcCtrl = { pad, topY, clientRc.right - pad, topY + ScaleDPI(68) };
    DrawRoundedBox(hdc, rcCtrl, ScaleDPI(10), theme.bgSurface, theme.border, 1);

    g_App.rcBtnDisableKeyboard = { rcCtrl.left + ScaleDPI(16), rcCtrl.top + ScaleDPI(14), rcCtrl.left + ScaleDPI(284), rcCtrl.bottom - ScaleDPI(14) };
    DrawButton(
        hdc,
        g_App.rcBtnDisableKeyboard,
        g_App.disableKeyboard ? L"Keyboard Disabled (Click to Enable)" : L"Disable Keyboard (Clean Mode)",
        g_App.disableKeyboard ? theme.danger : theme.bgElevated,
        g_App.disableKeyboard ? RGB(255, 255, 255) : theme.textPrimary,
        g_App.disableKeyboard ? theme.danger : theme.border,
        g_App.hFontBody
    );

    g_App.rcBtnToggleShortcutGuard = { g_App.rcBtnDisableKeyboard.right + ScaleDPI(10), rcCtrl.top + ScaleDPI(14), g_App.rcBtnDisableKeyboard.right + ScaleDPI(224), rcCtrl.bottom - ScaleDPI(14) };
    DrawButton(
        hdc,
        g_App.rcBtnToggleShortcutGuard,
        g_App.blockWinShortcuts ? L"Win Shortcuts: BLOCKED" : L"Win Shortcuts: ALLOWED",
        g_App.blockWinShortcuts ? theme.accent : theme.bgElevated,
        g_App.blockWinShortcuts ? RGB(15, 23, 42) : theme.textPrimary,
        g_App.blockWinShortcuts ? theme.accent : theme.border,
        g_App.hFontBody
    );

    g_App.rcBtnResetKeyboard = { g_App.rcBtnToggleShortcutGuard.right + ScaleDPI(10), rcCtrl.top + ScaleDPI(14), g_App.rcBtnToggleShortcutGuard.right + ScaleDPI(148), rcCtrl.bottom - ScaleDPI(14) };
    DrawButton(
        hdc,
        g_App.rcBtnResetKeyboard,
        L"Reset Lit Keys",
        theme.bgElevated,
        theme.textPrimary,
        theme.border,
        g_App.hFontBody
    );

    int latchedCount = 0;
    for (int i = 0; i < g_KeyCount; ++i) {
        if (g_App.keyLatched[g_KeyboardLayout[i].vk]) latchedCount++;
    }

    wchar_t statsBuf[256];
    swprintf(statsBuf, 256, L"Lit: %d/%d  |  NKRO: %d (Peak %d)  |  Presses: %d  |  Last: %s (0x%02X)",
             latchedCount, g_KeyCount, g_App.currentRolloverCount, g_App.peakRolloverCount,
             g_App.totalKeyPresses,
             g_App.lastKeyLabel[0] ? g_App.lastKeyLabel : L"None",
             g_App.lastVkCode);

    RECT rcStats = { g_App.rcBtnResetKeyboard.right + ScaleDPI(12), rcCtrl.top + ScaleDPI(10), rcCtrl.right - ScaleDPI(16), rcCtrl.bottom - ScaleDPI(10) };
    DrawRoundedBox(hdc, rcStats, ScaleDPI(6), theme.bgCanvas, theme.border, 1);
    RECT rcStatsText = { rcStats.left + ScaleDPI(10), rcStats.top, rcStats.right - ScaleDPI(10), rcStats.bottom };
    SelectObject(hdc, g_App.hFontSmall);
    SetTextColor(hdc, theme.textSecondary);
    DrawTextClipped(hdc, statsBuf, rcStatsText, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    RECT rcDeck = { pad, rcCtrl.bottom + ScaleDPI(14), clientRc.right - pad, clientRc.bottom - ScaleDPI(42) };
    DrawRoundedBox(hdc, rcDeck, ScaleDPI(12), theme.bgSurface, theme.border, 1);

    int deckW = (rcDeck.right - rcDeck.left) - ScaleDPI(40);
    int deckH = (rcDeck.bottom - rcDeck.top) - ScaleDPI(66);
    float unitW = (float)deckW / 23.0f;
    float unitH = (float)deckH / 6.25f;
    float unitSize = (unitW < unitH) ? unitW : unitH;
    int keyGap = ScaleDPI(4);

    int startX = rcDeck.left + ((rcDeck.right - rcDeck.left) - (int)(23.0f * unitSize)) / 2;
    int startY = rcDeck.top + ScaleDPI(20) + (deckH - (int)(6.25f * unitSize)) / 2;

    SelectObject(hdc, g_App.hFontKey);
    for (int i = 0; i < g_KeyCount; ++i) {
        const KeyDef& k = g_KeyboardLayout[i];
        RECT rcKey;
        rcKey.left   = startX + (int)(k.x * unitSize) + keyGap / 2;
        rcKey.top    = startY + (int)(k.y * unitSize) + keyGap / 2;
        rcKey.right  = startX + (int)((k.x + k.w) * unitSize) - keyGap / 2;
        rcKey.bottom = startY + (int)((k.y + k.h) * unitSize) - keyGap / 2;
        g_App.keyHitRects[i] = rcKey;

        bool isDown = g_App.keyCurrentlyDown[k.vk];
        bool isLatched = g_App.keyLatched[k.vk];

        COLORREF kBg = theme.bgElevated;
        COLORREF kFg = theme.textPrimary;
        COLORREF kBorder = theme.border;

        if (isDown) {
            kBg = theme.keyDown;
            kFg = RGB(15, 23, 42);
            kBorder = theme.keyDown;
        } else if (isLatched) {
            kBg = theme.keyLatched;
            kFg = RGB(255, 255, 255);
            kBorder = theme.keyLatched;
        }

        DrawRoundedBox(hdc, rcKey, ScaleDPI(6), kBg, kBorder, 1);
        SetTextColor(hdc, kFg);
        RECT rcKeyText = { rcKey.left + ScaleDPI(2), rcKey.top + ScaleDPI(2), rcKey.right - ScaleDPI(2), rcKey.bottom - ScaleDPI(2) };
        DrawTextClipped(hdc, k.label, rcKeyText, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    }

    RECT rcLegend = { rcDeck.left + ScaleDPI(24), rcDeck.bottom - ScaleDPI(34), rcDeck.right - ScaleDPI(24), rcDeck.bottom - ScaleDPI(8) };
    SelectObject(hdc, g_App.hFontSmall);
    SetTextColor(hdc, theme.textSecondary);
    DrawTextClipped(hdc, L"Tip: Press any physical key on your keyboard. Tested keys stay lit green until Reset.", rcLegend, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
}

void RenderMouseTab(HDC hdc, const RECT& clientRc, const ThemeColors& theme) {
    int pad = ScaleDPI(24);
    int topY = ScaleDPI(78);

    RECT rcCtrl = { pad, topY, clientRc.right - pad, topY + ScaleDPI(68) };
    DrawRoundedBox(hdc, rcCtrl, ScaleDPI(10), theme.bgSurface, theme.border, 1);

    g_App.rcBtnDisableMouse = { rcCtrl.left + ScaleDPI(16), rcCtrl.top + ScaleDPI(14), rcCtrl.left + ScaleDPI(336), rcCtrl.bottom - ScaleDPI(14) };
    DrawButton(
        hdc,
        g_App.rcBtnDisableMouse,
        g_App.disableMouse ? L"Mouse Disabled (Space 5x to Enable)" : L"Disable Mouse (Clean Mode)",
        g_App.disableMouse ? theme.danger : theme.bgElevated,
        g_App.disableMouse ? RGB(255, 255, 255) : theme.textPrimary,
        g_App.disableMouse ? theme.danger : theme.border,
        g_App.hFontBody
    );

    g_App.rcBtnResetMouse = { g_App.rcBtnDisableMouse.right + ScaleDPI(10), rcCtrl.top + ScaleDPI(14), g_App.rcBtnDisableMouse.right + ScaleDPI(180), rcCtrl.bottom - ScaleDPI(14) };
    DrawButton(hdc, g_App.rcBtnResetMouse, L"Reset Mouse Counters", theme.bgElevated, theme.textPrimary, theme.border, g_App.hFontBody);

    int totalFaults = 0;
    for (int i = 0; i < 5; ++i) totalFaults += g_App.mouseDoubleClickFaults[i];

    wchar_t summaryBuf[256];
    swprintf(summaryBuf, 256, L"Double-Click Faults (<80ms): %d   |   Scroll (Up/Down): %d / %d   |   Glitches: %d",
             totalFaults, g_App.scrollUpSteps, g_App.scrollDownSteps, g_App.scrollEncoderGlitches);

    RECT rcSummary = { g_App.rcBtnResetMouse.right + ScaleDPI(14), rcCtrl.top + ScaleDPI(10), rcCtrl.right - ScaleDPI(16), rcCtrl.bottom - ScaleDPI(10) };
    DrawRoundedBox(hdc, rcSummary, ScaleDPI(6), theme.bgCanvas, theme.border, 1);
    RECT rcSummaryText = { rcSummary.left + ScaleDPI(10), rcSummary.top, rcSummary.right - ScaleDPI(10), rcSummary.bottom };
    SelectObject(hdc, g_App.hFontSmall);
    SetTextColor(hdc, (totalFaults > 0 || g_App.scrollEncoderGlitches > 0) ? theme.danger : theme.textSecondary);
    DrawTextClipped(hdc, summaryBuf, rcSummaryText, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    int contentTop = rcCtrl.bottom + ScaleDPI(14);
    int midX = (clientRc.right + clientRc.left) / 2;

    RECT rcLeft = { pad, contentTop, midX - ScaleDPI(9), clientRc.bottom - ScaleDPI(42) };
    DrawRoundedBox(hdc, rcLeft, ScaleDPI(12), theme.bgSurface, theme.border, 1);

    RECT rcLeftTitle = { rcLeft.left + ScaleDPI(20), rcLeft.top + ScaleDPI(14), rcLeft.right - ScaleDPI(20), rcLeft.top + ScaleDPI(40) };
    SelectObject(hdc, g_App.hFontTitle);
    SetTextColor(hdc, theme.textPrimary);
    DrawTextClipped(hdc, L"1. Double-Click Switch Bounce Test", rcLeftTitle, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    g_App.rcMouseTestArena = { rcLeft.left + ScaleDPI(20), rcLeft.top + ScaleDPI(46), rcLeft.right - ScaleDPI(20), rcLeft.top + ScaleDPI(138) };
    bool anyFault = (totalFaults > 0);
    DrawRoundedBox(hdc, g_App.rcMouseTestArena, ScaleDPI(10),
                   g_App.mouseBtnDown[0] ? theme.accent : theme.bgElevated,
                   anyFault ? theme.danger : theme.accent, 2);

    SelectObject(hdc, g_App.hFontBody);
    SetTextColor(hdc, g_App.mouseBtnDown[0] ? RGB(15, 23, 42) : theme.textPrimary);
    RECT rcArenaText = { g_App.rcMouseTestArena.left + ScaleDPI(10), g_App.rcMouseTestArena.top + ScaleDPI(4), g_App.rcMouseTestArena.right - ScaleDPI(10), g_App.rcMouseTestArena.bottom - ScaleDPI(4) };
    DrawTextClipped(hdc, L"CLICK OR SCROLL HERE (Left / Right / Middle / Side)", rcArenaText, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    const wchar_t* btnLabels[5] = { L"Left Button", L"Right Button", L"Middle Wheel Click", L"Side Back (X1)", L"Side Forward (X2)" };
    int rowTop = g_App.rcMouseTestArena.bottom + ScaleDPI(12);
    int rowH = ScaleDPI(38);

    for (int i = 0; i < 5; ++i) {
        RECT rcRow = { rcLeft.left + ScaleDPI(20), rowTop + i * (rowH + ScaleDPI(6)), rcLeft.right - ScaleDPI(20), rowTop + i * (rowH + ScaleDPI(6)) + rowH };
        if (rcRow.bottom > rcLeft.bottom - ScaleDPI(10)) break;
        COLORREF rowBorder = (g_App.mouseDoubleClickFaults[i] > 0) ? theme.danger : (g_App.mouseBtnDown[i] ? theme.accent : theme.border);
        DrawRoundedBox(hdc, rcRow, ScaleDPI(6), theme.bgElevated, rowBorder, 1);

        RECT rcLblLeft = { rcRow.left + ScaleDPI(14), rcRow.top + ScaleDPI(2), rcRow.left + ScaleDPI(186), rcRow.bottom - ScaleDPI(2) };
        SelectObject(hdc, g_App.hFontBody);
        SetTextColor(hdc, theme.textPrimary);
        DrawTextClipped(hdc, btnLabels[i], rcLblLeft, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

        wchar_t rowMetrics[160];
        if (g_App.lastClickDeltaMs[i] > 0.0) {
            swprintf(rowMetrics, 160, L"Clicks: %d   |   Interval: %.1f ms   |   Faults: %d",
                     g_App.mouseClickCount[i], g_App.lastClickDeltaMs[i], g_App.mouseDoubleClickFaults[i]);
        } else {
            swprintf(rowMetrics, 160, L"Clicks: %d   |   Interval: -- ms   |   Faults: %d",
                     g_App.mouseClickCount[i], g_App.mouseDoubleClickFaults[i]);
        }
        RECT rcLblRight = { rcRow.left + ScaleDPI(192), rcRow.top + ScaleDPI(2), rcRow.right - ScaleDPI(14), rcRow.bottom - ScaleDPI(2) };
        SelectObject(hdc, g_App.hFontSmall);
        SetTextColor(hdc, (g_App.mouseDoubleClickFaults[i] > 0) ? theme.danger : theme.textSecondary);
        DrawTextClipped(hdc, rowMetrics, rcLblRight, DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
    }

    // Right Card: Scroll Wheel Encoder Test + Progressing Graph
    RECT rcRight = { midX + ScaleDPI(9), contentTop, clientRc.right - pad, clientRc.bottom - ScaleDPI(42) };
    DrawRoundedBox(hdc, rcRight, ScaleDPI(12), theme.bgSurface, theme.border, 1);

    RECT rcRightTitle = { rcRight.left + ScaleDPI(20), rcRight.top + ScaleDPI(14), rcRight.right - ScaleDPI(20), rcRight.top + ScaleDPI(40) };
    SelectObject(hdc, g_App.hFontTitle);
    SetTextColor(hdc, theme.textPrimary);
    DrawTextClipped(hdc, L"2. Scroll Encoder Progressing Graph & Glitch Detector", rcRightTitle, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    RECT rcGraph = { rcRight.left + ScaleDPI(20), rcRight.top + ScaleDPI(46), rcRight.right - ScaleDPI(20), rcRight.top + ScaleDPI(220) };
    COLORREF graphBg = g_App.darkMode ? RGB(17, 21, 28) : theme.bgElevated;
    DrawRoundedBox(hdc, rcGraph, ScaleDPI(10), graphBg,
                   (g_App.scrollEncoderGlitches > 0) ? theme.danger : theme.border, 1);

    int plotLeft   = rcGraph.left + ScaleDPI(18);
    int plotRight  = rcGraph.right - ScaleDPI(18);
    int plotTop    = rcGraph.top + ScaleDPI(18);
    int plotBottom = rcGraph.bottom - ScaleDPI(36);
    int plotMidY   = (plotTop + plotBottom) / 2;
    int barHeight  = (plotBottom - plotTop) / 2 - ScaleDPI(4);

    // Static Horizontal Center Baseline using DC_PEN
    HGDIOBJ oldPen = SelectObject(hdc, GetStockObject(DC_PEN));
    SetDCPenColor(hdc, g_App.darkMode ? RGB(45, 55, 72) : theme.border);
    MoveToEx(hdc, plotLeft, plotMidY, NULL);
    LineTo(hdc, plotRight, plotMidY);
    SelectObject(hdc, oldPen);

    // Draw Vertical Scroll Step Bars from O(1) Ring Buffer
    int barW   = ScaleDPI(4);
    int barGap = ScaleDPI(2);
    int maxBars = (plotRight - plotLeft) / (barW + barGap);
    if (maxBars < 10) maxBars = 10;

    int count = g_App.scrollRingCount;
    int startOffset = (count > maxBars) ? (count - maxBars) : 0;

    COLORREF colUp        = RGB(34, 197, 94);   // Green (Up)
    COLORREF colDown      = RGB(37, 99, 235);   // Blue (Down)
    COLORREF colAnalyzing = RGB(217, 119, 6);   // Amber (Analyzing)
    COLORREF colError     = RGB(220, 38, 38);   // Red (Encoder error)

    for (int i = startOffset; i < count; ++i) {
        int slot = i - startOffset;
        int x = plotLeft + slot * (barW + barGap);
        if (x + barW > plotRight) break;

        int ringIdx = (g_App.scrollRingHead + i) % MAX_SCROLL_SAMPLES;
        const ScrollGraphPoint& pt = g_App.scrollRing[ringIdx];
        COLORREF barColor = (pt.stepDir > 0) ? colUp : colDown;
        if (pt.state == TICK_ANALYZING) barColor = colAnalyzing;
        else if (pt.state == TICK_ERROR) barColor = colError;

        RECT rcBar;
        rcBar.left  = x;
        rcBar.right = x + barW;
        if (pt.stepDir > 0) {
            rcBar.top    = plotMidY - barHeight;
            rcBar.bottom = plotMidY;
        } else {
            rcBar.top    = plotMidY + 1;
            rcBar.bottom = plotMidY + 1 + barHeight;
        }
        FillSolidRectFast(hdc, rcBar, barColor);
    }

    int legY = rcGraph.bottom - ScaleDPI(26);
    int legX = plotLeft;
    int boxSz = ScaleDPI(11);
    struct LegendItem { COLORREF col; const wchar_t* label; int width; };
    LegendItem items[4] = {
        { colUp,        L"Up",            ScaleDPI(56)  },
        { colDown,      L"Down",          ScaleDPI(76)  },
        { colAnalyzing, L"Analyzing",     ScaleDPI(102) },
        { colError,     L"Encoder error", ScaleDPI(130) }
    };

    SelectObject(hdc, g_App.hFontSmall);
    SetTextColor(hdc, theme.textSecondary);
    for (int i = 0; i < 4; ++i) {
        RECT rcSwatch = { legX, legY + ScaleDPI(3), legX + boxSz, legY + ScaleDPI(3) + boxSz };
        DrawRoundedBox(hdc, rcSwatch, ScaleDPI(3), items[i].col, items[i].col, 0);
        RECT rcLbl = { legX + boxSz + ScaleDPI(6), legY, legX + items[i].width, legY + ScaleDPI(18) };
        DrawTextClipped(hdc, items[i].label, rcLbl, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        legX += items[i].width + ScaleDPI(8);
    }

    RECT rcLogHeader = { rcRight.left + ScaleDPI(20), rcGraph.bottom + ScaleDPI(10), rcRight.right - ScaleDPI(20), rcGraph.bottom + ScaleDPI(30) };
    SelectObject(hdc, g_App.hFontBody);
    SetTextColor(hdc, theme.textPrimary);
    DrawTextClipped(hdc, L"Real-Time Switch & Encoder Diagnostic Log:", rcLogHeader, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    int logY = rcLogHeader.bottom + ScaleDPI(4);
    int lineH = ScaleDPI(21);
    SelectObject(hdc, g_App.hFontSmall);
    if (g_App.mouseLogCount == 0) {
        RECT rcEmpty = { rcRight.left + ScaleDPI(20), logY, rcRight.right - ScaleDPI(20), logY + ScaleDPI(24) };
        SetTextColor(hdc, theme.textSecondary);
        DrawTextClipped(hdc, L"No mouse events recorded yet. Click or scroll inside the window to begin.", rcEmpty, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    } else {
        for (int i = 0; i < g_App.mouseLogCount; ++i) {
            RECT rcLine = { rcRight.left + ScaleDPI(20), logY + i * lineH, rcRight.right - ScaleDPI(20), logY + (i + 1) * lineH };
            if (rcLine.bottom > rcRight.bottom - ScaleDPI(10)) break;
            SetTextColor(hdc, g_App.mouseLogRing[i].isFault ? theme.danger : theme.textSecondary);
            DrawTextClipped(hdc, g_App.mouseLogRing[i].text, rcLine, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        }
    }
}

void RenderSpeakerTab(HDC hdc, const RECT& clientRc, const ThemeColors& theme) {
    int pad = ScaleDPI(24);
    int topY = ScaleDPI(78);

    RECT rcCard = { pad, topY, clientRc.right - pad, clientRc.bottom - ScaleDPI(42) };
    DrawRoundedBox(hdc, rcCard, ScaleDPI(12), theme.bgSurface, theme.border, 1);

    int innerLeft = rcCard.left + ScaleDPI(32);
    int innerRight = rcCard.right - ScaleDPI(32);
    int y = rcCard.top + ScaleDPI(24);

    RECT rcTitle = { innerLeft, y, innerLeft + ScaleDPI(560), y + ScaleDPI(42) };
    SelectObject(hdc, g_App.hFontTitle);
    SetTextColor(hdc, theme.textPrimary);
    DrawTextW(hdc, L"Speaker Frequency Sweep, Synth & Channel Balance", -1, &rcTitle, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);

    g_App.rcBtnPlayToggle = { innerRight - ScaleDPI(210), y, innerRight, y + ScaleDPI(42) };
    DrawButton(
        hdc,
        g_App.rcBtnPlayToggle,
        g_App.speakerPlaying ? L"STOP AUDIO TEST" : L"START AUDIO TEST",
        g_App.speakerPlaying ? theme.danger : theme.keyLatched,
        RGB(255, 255, 255),
        g_App.speakerPlaying ? theme.danger : theme.keyLatched,
        g_App.hFontBody
    );

    y += ScaleDPI(58);

    // Mode Row: [Auto Log Sweep]  [Manual Fixed Frequency]  [Synth]
    g_App.rcBtnModeSweep = { innerLeft, y, innerLeft + ScaleDPI(235), y + ScaleDPI(40) };
    DrawButton(
        hdc,
        g_App.rcBtnModeSweep,
        L"Auto Log Sweep (20Hz-20kHz)",
        (g_App.speakerMode == SPK_MODE_SWEEP) ? theme.accent : theme.bgElevated,
        (g_App.speakerMode == SPK_MODE_SWEEP) ? RGB(15, 23, 42) : theme.textPrimary,
        (g_App.speakerMode == SPK_MODE_SWEEP) ? theme.accent : theme.border,
        g_App.hFontBody
    );

    g_App.rcBtnModeFixed = { g_App.rcBtnModeSweep.right + ScaleDPI(10), y, g_App.rcBtnModeSweep.right + ScaleDPI(230), y + ScaleDPI(40) };
    DrawButton(
        hdc,
        g_App.rcBtnModeFixed,
        L"Manual Fixed Frequency",
        (g_App.speakerMode == SPK_MODE_FIXED) ? theme.accent : theme.bgElevated,
        (g_App.speakerMode == SPK_MODE_FIXED) ? RGB(15, 23, 42) : theme.textPrimary,
        (g_App.speakerMode == SPK_MODE_FIXED) ? theme.accent : theme.border,
        g_App.hFontBody
    );

    // Synth Button placed directly on the right side of Manual Fixed Frequency
    g_App.rcBtnModeSynth = { g_App.rcBtnModeFixed.right + ScaleDPI(10), y, g_App.rcBtnModeFixed.right + ScaleDPI(160), y + ScaleDPI(40) };
    DrawButton(
        hdc,
        g_App.rcBtnModeSynth,
        L"Synth",
        (g_App.speakerMode == SPK_MODE_SYNTH) ? theme.accent : theme.bgElevated,
        (g_App.speakerMode == SPK_MODE_SYNTH) ? RGB(15, 23, 42) : theme.textPrimary,
        (g_App.speakerMode == SPK_MODE_SYNTH) ? theme.accent : theme.border,
        g_App.hFontBody
    );

    wchar_t freqText[180];
    if (g_App.speakerMode == SPK_MODE_SYNTH) {
        swprintf(freqText, 180, L"Built-in Synth (%.0f Hz)", g_App.currentFreqHz);
    } else {
        swprintf(freqText, 180, L"Frequency: %.0f Hz", g_App.currentFreqHz);
    }

    RECT rcFreqReadout = { g_App.rcBtnModeSynth.right + ScaleDPI(12), y, innerRight, y + ScaleDPI(40) };
    SelectObject(hdc, g_App.hFontBody);
    SetTextColor(hdc, theme.accent);
    DrawTextW(hdc, freqText, -1, &rcFreqReadout, DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);

    y += ScaleDPI(54);

    g_App.rcSliderFreq = { innerLeft, y, innerRight, y + ScaleDPI(34) };
    DrawRoundedBox(hdc, g_App.rcSliderFreq, ScaleDPI(8), theme.bgElevated, theme.border, 1);

    double normFreq = log(g_App.currentFreqHz / g_App.sweepStartHz) / log(g_App.sweepEndHz / g_App.sweepStartHz);
    if (normFreq < 0.0) normFreq = 0.0;
    if (normFreq > 1.0) normFreq = 1.0;

    int fillW = (int)(normFreq * (g_App.rcSliderFreq.right - g_App.rcSliderFreq.left));
    if (fillW > ScaleDPI(8)) {
        RECT rcFill = { g_App.rcSliderFreq.left, g_App.rcSliderFreq.top, g_App.rcSliderFreq.left + fillW, g_App.rcSliderFreq.bottom };
        DrawRoundedBox(hdc, rcFill, ScaleDPI(8), theme.accent, theme.accent, 0);
    }

    RECT rcFreqHint = { innerLeft, g_App.rcSliderFreq.bottom + ScaleDPI(6), innerRight, g_App.rcSliderFreq.bottom + ScaleDPI(26) };
    SelectObject(hdc, g_App.hFontSmall);
    SetTextColor(hdc, theme.textSecondary);
    DrawTextW(hdc, L"20 Hz (Sub-Bass)", -1, &rcFreqHint, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    DrawTextW(hdc, L"1,000 Hz (Midrange) - Click/Drag to Scrub", -1, &rcFreqHint, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    DrawTextW(hdc, L"20,000 Hz (Brilliance)", -1, &rcFreqHint, DT_RIGHT | DT_VCENTER | DT_SINGLELINE);

    y = rcFreqHint.bottom + ScaleDPI(30);

    RECT rcBalTitle = { innerLeft, y, innerRight, y + ScaleDPI(32) };
    SelectObject(hdc, g_App.hFontTitle);
    SetTextColor(hdc, theme.textPrimary);
    DrawTextW(hdc, L"Left / Right Stereo Channel Balance Test", -1, &rcBalTitle, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    y += ScaleDPI(40);
    int btnW = ScaleDPI(200);
    g_App.rcBtnChanLeft = { innerLeft, y, innerLeft + btnW, y + ScaleDPI(42) };
    bool isLeftOnly = (g_App.channelBalance <= -0.95f);
    DrawButton(hdc, g_App.rcBtnChanLeft, L"Left Speaker Only (L)",
               isLeftOnly ? theme.accent : theme.bgElevated,
               isLeftOnly ? RGB(15, 23, 42) : theme.textPrimary,
               isLeftOnly ? theme.accent : theme.border, g_App.hFontBody);

    g_App.rcBtnChanCenter = { g_App.rcBtnChanLeft.right + ScaleDPI(14), y, g_App.rcBtnChanLeft.right + ScaleDPI(14) + btnW, y + ScaleDPI(42) };
    bool isCenter = (fabs(g_App.channelBalance) < 0.05f);
    DrawButton(hdc, g_App.rcBtnChanCenter, L"Center (Both L + R)",
               isCenter ? theme.accent : theme.bgElevated,
               isCenter ? RGB(15, 23, 42) : theme.textPrimary,
               isCenter ? theme.accent : theme.border, g_App.hFontBody);

    g_App.rcBtnChanRight = { g_App.rcBtnChanCenter.right + ScaleDPI(14), y, g_App.rcBtnChanCenter.right + ScaleDPI(14) + btnW, y + ScaleDPI(42) };
    bool isRightOnly = (g_App.channelBalance >= 0.95f);
    DrawButton(hdc, g_App.rcBtnChanRight, L"Right Speaker Only (R)",
               isRightOnly ? theme.accent : theme.bgElevated,
               isRightOnly ? RGB(15, 23, 42) : theme.textPrimary,
               isRightOnly ? theme.accent : theme.border, g_App.hFontBody);

    wchar_t balReadout[128];
    if (g_App.channelBalance < -0.02f) {
        swprintf(balReadout, 128, L"Balance: %.0f%% Left", -g_App.channelBalance * 100.0f);
    } else if (g_App.channelBalance > 0.02f) {
        swprintf(balReadout, 128, L"Balance: %.0f%% Right", g_App.channelBalance * 100.0f);
    } else {
        swprintf(balReadout, 128, L"Balance: Center (50%% L / 50%% R)");
    }

    RECT rcBalText = { g_App.rcBtnChanRight.right + ScaleDPI(16), y, innerRight, y + ScaleDPI(42) };
    SelectObject(hdc, g_App.hFontBody);
    SetTextColor(hdc, theme.textSecondary);
    DrawTextW(hdc, balReadout, -1, &rcBalText, DT_RIGHT | DT_VCENTER | DT_SINGLELINE);

    y += ScaleDPI(56);
    g_App.rcSliderBalance = { innerLeft, y, innerRight, y + ScaleDPI(32) };
    DrawRoundedBox(hdc, g_App.rcSliderBalance, ScaleDPI(8), theme.bgElevated, theme.border, 1);

    int balMidX = (g_App.rcSliderBalance.left + g_App.rcSliderBalance.right) / 2;
    int balThumbX = balMidX + (int)(g_App.channelBalance * ((g_App.rcSliderBalance.right - g_App.rcSliderBalance.left) / 2 - ScaleDPI(16)));
    RECT rcBalThumb = { balThumbX - ScaleDPI(14), g_App.rcSliderBalance.top + ScaleDPI(3), balThumbX + ScaleDPI(14), g_App.rcSliderBalance.bottom - ScaleDPI(3) };
    DrawRoundedBox(hdc, rcBalThumb, ScaleDPI(6), theme.accent, theme.accent, 0);

    y += ScaleDPI(50);
    wchar_t volLabel[64];
    swprintf(volLabel, 64, L"Output Gain Volume: %.0f%% (Default: 1%%)", g_App.masterVolume * 100.0f);
    RECT rcVolTitle = { innerLeft, y, innerRight, y + ScaleDPI(28) };
    SelectObject(hdc, g_App.hFontBody);
    SetTextColor(hdc, theme.textPrimary);
    DrawTextW(hdc, volLabel, -1, &rcVolTitle, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    y += ScaleDPI(30);
    g_App.rcSliderVolume = { innerLeft, y, innerRight, y + ScaleDPI(28) };
    DrawRoundedBox(hdc, g_App.rcSliderVolume, ScaleDPI(8), theme.bgElevated, theme.border, 1);
    int volW = (int)(g_App.masterVolume * (g_App.rcSliderVolume.right - g_App.rcSliderVolume.left));
    if (volW > ScaleDPI(6)) {
        RECT rcVolFill = { g_App.rcSliderVolume.left, g_App.rcSliderVolume.top, g_App.rcSliderVolume.left + volW, g_App.rcSliderVolume.bottom };
        DrawRoundedBox(hdc, rcVolFill, ScaleDPI(8), theme.keyLatched, theme.keyLatched, 0);
    }
}

// ============================================================================
// Master Window Paint Procedure (Persistent Double-Buffered GDI)
// ============================================================================
void RenderApp(HWND hwnd, HDC hdcScreen) {
    RECT clientRc;
    GetClientRect(hwnd, &clientRc);
    int width = clientRc.right - clientRc.left;
    int height = clientRc.bottom - clientRc.top;
    if (width <= 0 || height <= 0) return;

    if (!g_App.hFontTitle) {
        RebuildFontsForDPI();
    }

    if (!g_App.hdcBack || g_App.backW != width || g_App.backH != height) {
        if (g_App.hdcBack) {
            if (g_App.hOldBmBack) SelectObject(g_App.hdcBack, g_App.hOldBmBack);
            if (g_App.hbmBack) DeleteObject(g_App.hbmBack);
            DeleteDC(g_App.hdcBack);
        }
        g_App.hdcBack = CreateCompatibleDC(hdcScreen);
        g_App.hbmBack = CreateCompatibleBitmap(hdcScreen, width, height);
        g_App.hOldBmBack = SelectObject(g_App.hdcBack, g_App.hbmBack);
        g_App.backW = width;
        g_App.backH = height;
    }

    HDC hdc = g_App.hdcBack;
    const ThemeColors& theme = g_App.darkMode ? THEME_DARK : THEME_LIGHT;

    FillSolidRectFast(hdc, clientRc, theme.bgCanvas);

    // Brand Title on Left
    RECT rcBrand = { ScaleDPI(24), ScaleDPI(12), ScaleDPI(360), ScaleDPI(48) };
    SelectObject(hdc, g_App.hFontTitle);
    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, theme.textPrimary);
    DrawTextW(hdc, L"MKS-test v1.0", -1, &rcBrand, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    int segW = ScaleDPI(140);
    int segH = ScaleDPI(34);
    int totalSegW = segW * 3;
    int segStartX = (width - totalSegW) / 2;
    int segTopY = ScaleDPI(12);

    RECT rcSegGroup = { segStartX - ScaleDPI(4), segTopY - ScaleDPI(4), segStartX + totalSegW + ScaleDPI(4), segTopY + segH + ScaleDPI(4) };
    DrawRoundedBox(hdc, rcSegGroup, ScaleDPI(10), theme.bgSurface, theme.border, 1);

    g_App.rcTabMouse    = { segStartX, segTopY, segStartX + segW, segTopY + segH };
    g_App.rcTabKeyboard = { segStartX + segW, segTopY, segStartX + segW * 2, segTopY + segH };
    g_App.rcTabSpeaker  = { segStartX + segW * 2, segTopY, segStartX + segW * 3, segTopY + segH };

    DrawButton(hdc, g_App.rcTabMouse, L"Mouse",
               (g_App.currentTab == TAB_MOUSE) ? theme.accent : theme.bgSurface,
               (g_App.currentTab == TAB_MOUSE) ? RGB(15, 23, 42) : theme.textPrimary,
               (g_App.currentTab == TAB_MOUSE) ? theme.accent : theme.bgSurface, g_App.hFontTitle, 7);

    DrawButton(hdc, g_App.rcTabKeyboard, L"Keyboard",
               (g_App.currentTab == TAB_KEYBOARD) ? theme.accent : theme.bgSurface,
               (g_App.currentTab == TAB_KEYBOARD) ? RGB(15, 23, 42) : theme.textPrimary,
               (g_App.currentTab == TAB_KEYBOARD) ? theme.accent : theme.bgSurface, g_App.hFontTitle, 7);

    DrawButton(hdc, g_App.rcTabSpeaker, L"Speaker",
               (g_App.currentTab == TAB_SPEAKER) ? theme.accent : theme.bgSurface,
               (g_App.currentTab == TAB_SPEAKER) ? RGB(15, 23, 42) : theme.textPrimary,
               (g_App.currentTab == TAB_SPEAKER) ? theme.accent : theme.bgSurface, g_App.hFontTitle, 7);

    // Device Name placed directly below [Mouse | Keyboard | Speaker] button
    const wchar_t* activeDevName = g_App.mouseDeviceName;
    if (g_App.currentTab == TAB_KEYBOARD) activeDevName = g_App.keyboardDeviceName;
    else if (g_App.currentTab == TAB_SPEAKER) activeDevName = g_App.speakerDeviceName;

    RECT rcDevName = { ScaleDPI(190), rcSegGroup.bottom + ScaleDPI(4), width - ScaleDPI(190), rcSegGroup.bottom + ScaleDPI(26) };
    SelectObject(hdc, g_App.hFontSmall);
    SetTextColor(hdc, theme.textSecondary);
    DrawTextClipped(hdc, activeDevName, rcDevName, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    g_App.rcBtnDarkMode = { width - ScaleDPI(164), segTopY, width - ScaleDPI(24), segTopY + segH };
    DrawButton(hdc, g_App.rcBtnDarkMode,
               g_App.darkMode ? L"Theme: Dark" : L"Theme: Light",
               theme.bgSurface, theme.textPrimary, theme.border, g_App.hFontBody, 8);

    if (g_App.currentTab == TAB_KEYBOARD) {
        RenderKeyboardTab(hdc, clientRc, theme);
    } else if (g_App.currentTab == TAB_MOUSE) {
        RenderMouseTab(hdc, clientRc, theme);
    } else if (g_App.currentTab == TAB_SPEAKER) {
        RenderSpeakerTab(hdc, clientRc, theme);
    }

    // Permanent bottom info bar across the app
    RECT rcBottomInfo = { ScaleDPI(24), height - ScaleDPI(36), width - ScaleDPI(24), height - ScaleDPI(8) };
    SelectObject(hdc, g_App.hFontSmall);
    SetTextColor(hdc, theme.textSecondary);
    DrawTextW(hdc, L"\u24D8  Shortcut: Press Space 5 times to enable mouse and keyboard", -1, &rcBottomInfo, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    BitBlt(hdcScreen, 0, 0, width, height, hdc, 0, 0, SRCCOPY);
}

// ============================================================================
// Slider Interaction Helpers
// ============================================================================
void UpdateSpeakerSlidersFromMouse(int x) {
    if (g_App.draggingFreqSlider) {
        double t = (double)(x - g_App.rcSliderFreq.left) / (double)(g_App.rcSliderFreq.right - g_App.rcSliderFreq.left);
        if (t < 0.0) t = 0.0;
        if (t > 1.0) t = 1.0;
        g_App.speakerMode = SPK_MODE_FIXED;
        g_App.fixedFreqHz = g_App.sweepStartHz * pow(g_App.sweepEndHz / g_App.sweepStartHz, t);
        g_App.currentFreqHz = g_App.fixedFreqHz;
        InvalidateRect(g_App.hwnd, NULL, FALSE);
    }
    if (g_App.draggingBalanceSlider) {
        double t = (double)(x - g_App.rcSliderBalance.left) / (double)(g_App.rcSliderBalance.right - g_App.rcSliderBalance.left);
        if (t < 0.0) t = 0.0;
        if (t > 1.0) t = 1.0;
        g_App.channelBalance = (float)(t * 2.0 - 1.0);
        InvalidateRect(g_App.hwnd, NULL, FALSE);
    }
    if (g_App.draggingVolumeSlider) {
        double t = (double)(x - g_App.rcSliderVolume.left) / (double)(g_App.rcSliderVolume.right - g_App.rcSliderVolume.left);
        if (t < 0.0) t = 0.0;
        if (t > 1.0) t = 1.0;
        g_App.masterVolume = (float)t;
        InvalidateRect(g_App.hwnd, NULL, FALSE);
    }
}

// ============================================================================
// Main Window Procedure
// ============================================================================
LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_CREATE: {
        g_App.hwnd = hwnd;
        g_App.currentTab = TAB_MOUSE;
        g_App.darkMode = true;
        g_App.blockWinShortcuts = true;
        g_App.doubleClickThresholdMs = 80.0;
        g_App.speakerMode = SPK_MODE_SWEEP;
        g_App.sweepStartHz = 20.0;
        g_App.sweepEndHz = 20000.0;
        g_App.fixedFreqHz = 440.0;
        g_App.currentFreqHz = 440.0;
        g_App.smoothedFreqHz = 440.0;
        g_App.channelBalance = 0.0f;
        g_App.masterVolume = 0.01f;
        g_App.smoothedLeftGain = 0.01f;
        g_App.smoothedRightGain = 0.01f;
        g_App.activeVirtualKeyDown = -1;

        LARGE_INTEGER freq;
        QueryPerformanceFrequency(&freq);
        g_App.qpcFreq = freq.QuadPart;

        LoadAppSettings();

        HMODULE hUser32 = GetModuleHandleW(L"user32.dll");
        if (hUser32) {
            typedef UINT(WINAPI* PFN_GetDpiForWindow)(HWND);
            PFN_GetDpiForWindow pGetDpi = (PFN_GetDpiForWindow)GetProcAddress(hUser32, "GetDpiForWindow");
            if (pGetDpi) g_App.dpi = pGetDpi(hwnd);
        }
        if (g_App.dpi == 0) g_App.dpi = 96;

        RebuildFontsForDPI();
        SyncWin32TitleBarTheme(hwnd, g_App.darkMode);
        InitAudioEngine(hwnd);
        DetectHardwareDeviceNames(hwnd);

        // Disable IME on the diagnostic window so physical keys are not intercepted by Chinese/Japanese/Korean IMEs
        HMODULE hImm32 = LoadLibraryW(L"imm32.dll");
        if (hImm32) {
            typedef HANDLE(WINAPI* PFN_ImmAssociateContext)(HWND, HANDLE);
            PFN_ImmAssociateContext pImmAssoc = (PFN_ImmAssociateContext)GetProcAddress(hImm32, "ImmAssociateContext");
            if (pImmAssoc) pImmAssoc(hwnd, NULL);
        }

        SetTimer(hwnd, 1, 16, NULL);
        return 0;
    }

    case WM_GETMINMAXINFO: {
        UINT dpi = g_App.dpi ? g_App.dpi : 96;
        DWORD winStyle = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX;
        RECT rcWin = { 0, 0, MulDiv(1280, dpi, 96), MulDiv(720, dpi, 96) };
        AdjustWindowRectEx(&rcWin, winStyle, FALSE, 0);
        int fixedW = rcWin.right - rcWin.left;
        int fixedH = rcWin.bottom - rcWin.top;
        MINMAXINFO* mmi = (MINMAXINFO*)lParam;
        mmi->ptMinTrackSize.x = fixedW;
        mmi->ptMinTrackSize.y = fixedH;
        mmi->ptMaxTrackSize.x = fixedW;
        mmi->ptMaxTrackSize.y = fixedH;
        return 0;
    }

    case WM_KEYDOWN:
    case WM_SYSKEYDOWN: {
        UINT vk = (UINT)wParam;
        UINT sc = (HIWORD(lParam) & 0xFF);
        bool isExt = (HIWORD(lParam) & KF_EXTENDED) != 0;
        ProcessPhysicalKeyEvent(vk, sc, isExt, true, false, true);
        return 0;
    }

    case WM_KEYUP:
    case WM_SYSKEYUP: {
        UINT vk = (UINT)wParam;
        UINT sc = (HIWORD(lParam) & 0xFF);
        bool isExt = (HIWORD(lParam) & KF_EXTENDED) != 0;
        ProcessPhysicalKeyEvent(vk, sc, isExt, false, true, true);
        return 0;
    }

    case WM_INPUT: {
        UINT dwSize = 0;
        if (GetRawInputData((HRAWINPUT)lParam, RID_INPUT, NULL, &dwSize, sizeof(RAWINPUTHEADER)) == 0 && dwSize > 0 && dwSize < 1024) {
            BYTE rawBuf[1024];
            if (GetRawInputData((HRAWINPUT)lParam, RID_INPUT, rawBuf, &dwSize, sizeof(RAWINPUTHEADER)) == dwSize) {
                RAWINPUT* raw = (RAWINPUT*)rawBuf;
                if (raw->header.dwType == RIM_TYPEKEYBOARD) {
                    USHORT vkey = raw->data.keyboard.VKey;
                    USHORT makeCode = raw->data.keyboard.MakeCode;
                    USHORT flags = raw->data.keyboard.Flags;
                    bool isUp = (flags & RI_KEY_BREAK) != 0;
                    bool isDown = !isUp;
                    bool isExt = (flags & RI_KEY_E0) != 0;
                    ProcessPhysicalKeyEvent(vkey, makeCode, isExt, isDown, isUp, !IsIconic(hwnd));
                }
                if (raw->header.hDevice) {
                    bool isRealInput = (raw->header.dwType == RIM_TYPEKEYBOARD) ||
                                       (raw->header.dwType == RIM_TYPEMOUSE &&
                                        (raw->data.mouse.lLastX != 0 || raw->data.mouse.lLastY != 0 || raw->data.mouse.usButtonFlags != 0));
                    if (isRealInput) {
                        UINT nameLen = 0;
                        if (GetRawInputDeviceInfoW(raw->header.hDevice, RIDI_DEVICENAME, NULL, &nameLen) == 0 && nameLen > 0 && nameLen < 512) {
                            wchar_t pathBuf[512] = {};
                            if (GetRawInputDeviceInfoW(raw->header.hDevice, RIDI_DEVICENAME, pathBuf, &nameLen) != (UINT)-1) {
                                wchar_t resolved[128] = {};
                                int score = 0;
                                if (ResolveRawDeviceNameFromPath(pathBuf, raw->header.dwType, resolved, 128, &score)) {
                                    score += 15; // Active hardware input bonus
                                    if (raw->header.dwType == RIM_TYPEMOUSE && score >= g_App.mouseDeviceScore) {
                                        g_App.mouseDeviceScore = score;
                                        if (wcscmp(g_App.mouseDeviceName, resolved) != 0) {
                                            wcsncpy(g_App.mouseDeviceName, resolved, 127);
                                            g_App.mouseDeviceName[127] = L'\0';
                                            if (g_App.currentTab == TAB_MOUSE) InvalidateRect(hwnd, NULL, FALSE);
                                        }
                                    } else if (raw->header.dwType == RIM_TYPEKEYBOARD && score >= g_App.keyboardDeviceScore) {
                                        g_App.keyboardDeviceScore = score;
                                        if (wcscmp(g_App.keyboardDeviceName, resolved) != 0) {
                                            wcsncpy(g_App.keyboardDeviceName, resolved, 127);
                                            g_App.keyboardDeviceName[127] = L'\0';
                                            if (g_App.currentTab == TAB_KEYBOARD) InvalidateRect(hwnd, NULL, FALSE);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    case MM_WOM_DONE: {
        if (g_App.speakerPlaying && g_App.hWaveOut) {
            WAVEHDR* pHdr = (WAVEHDR*)lParam;
            FillAudioBuffer((short*)pHdr->lpData, AUDIO_BUFFER_SAMPLES);
            waveOutWrite(g_App.hWaveOut, pHdr, sizeof(WAVEHDR));
        }
        return 0;
    }

    case WM_DPICHANGED: {
        g_App.dpi = HIWORD(wParam);
        RebuildFontsForDPI();
        RECT* const prcNewWindow = (RECT*)lParam;
        SetWindowPos(hwnd, NULL,
                     prcNewWindow->left, prcNewWindow->top,
                     prcNewWindow->right - prcNewWindow->left,
                     prcNewWindow->bottom - prcNewWindow->top,
                     SWP_NOZORDER | SWP_NOACTIVATE);
        InvalidateRect(hwnd, NULL, FALSE);
        return 0;
    }

    case WM_TIMER: {
        if (wParam == 1) {
            if (g_App.currentTab == TAB_KEYBOARD && !IsIconic(hwnd) && !g_App.disableKeyboard && IsAppWindowActive()) {
                for (int i = 0; i < g_KeyCount; ++i) {
                    UINT vk = g_KeyboardLayout[i].vk;
                    if (vk == 0 || vk >= 256 || vk == VK_NUMPAD_ENTER_SYNTH) continue;
                    bool physDown = (GetAsyncKeyState((int)vk) & 0x8000) != 0;
                    if (physDown) {
                        g_App.asyncPolledDown[vk] = true;
                        if (!g_App.keyCurrentlyDown[vk]) {
                            UINT sc = MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
                            ProcessPhysicalKeyEvent(vk, sc, g_KeyboardLayout[i].ext, true, false, true);
                        }
                    } else if (g_App.asyncPolledDown[vk]) {
                        g_App.asyncPolledDown[vk] = false;
                        if (g_App.keyCurrentlyDown[vk]) {
                            UINT sc = MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
                            ProcessPhysicalKeyEvent(vk, sc, g_KeyboardLayout[i].ext, false, true, true);
                        }
                    }
                }
            }
            if (g_App.currentTab == TAB_SPEAKER && g_App.speakerPlaying &&
                (g_App.speakerMode == SPK_MODE_SWEEP || g_App.speakerMode == SPK_MODE_SYNTH)) {
                InvalidateRect(hwnd, NULL, FALSE);
            }
            if (g_App.currentTab == TAB_MOUSE && g_App.scrollRingCount > 0) {
                LARGE_INTEGER now;
                QueryPerformanceCounter(&now);
                bool changed = false;
                for (int i = 0; i < g_App.scrollRingCount; ++i) {
                    int ringIdx = (g_App.scrollRingHead + i) % MAX_SCROLL_SAMPLES;
                    if (g_App.scrollRing[ringIdx].state == TICK_ANALYZING) {
                        double ageMs = (double)(now.QuadPart - g_App.scrollRing[ringIdx].tickTime) * 1000.0 / (double)g_App.qpcFreq;
                        if (ageMs >= 160.0) {
                            g_App.scrollRing[ringIdx].state = TICK_NORMAL;
                            changed = true;
                        }
                    }
                }
                if (changed) InvalidateRect(hwnd, NULL, FALSE);
            }
        }
        return 0;
    }

    case WM_ERASEBKGND:
        return 1;

    case WM_PAINT: {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(hwnd, &ps);
        RenderApp(hwnd, hdc);
        EndPaint(hwnd, &ps);
        return 0;
    }

    case WM_LBUTTONDOWN: {
        POINT pt = { (short)LOWORD(lParam), (short)HIWORD(lParam) };

        if (PtInRect(&g_App.rcTabKeyboard, pt)) {
            g_App.currentTab = TAB_KEYBOARD;
            SaveAppSettings();
            InvalidateRect(hwnd, NULL, FALSE);
            return 0;
        }
        if (PtInRect(&g_App.rcTabMouse, pt)) {
            g_App.currentTab = TAB_MOUSE;
            SaveAppSettings();
            InvalidateRect(hwnd, NULL, FALSE);
            return 0;
        }
        if (PtInRect(&g_App.rcTabSpeaker, pt)) {
            g_App.currentTab = TAB_SPEAKER;
            SaveAppSettings();
            InvalidateRect(hwnd, NULL, FALSE);
            return 0;
        }
        if (PtInRect(&g_App.rcBtnDarkMode, pt)) {
            g_App.darkMode = !g_App.darkMode;
            SyncWin32TitleBarTheme(hwnd, g_App.darkMode);
            SaveAppSettings();
            InvalidateRect(hwnd, NULL, FALSE);
            return 0;
        }

        if (g_App.currentTab == TAB_KEYBOARD) {
            if (PtInRect(&g_App.rcBtnDisableKeyboard, pt)) {
                g_App.disableKeyboard = !g_App.disableKeyboard;
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnToggleShortcutGuard, pt)) {
                g_App.blockWinShortcuts = !g_App.blockWinShortcuts;
                SaveAppSettings();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnResetKeyboard, pt)) {
                memset(g_App.keyLatched, 0, sizeof(g_App.keyLatched));
                memset(g_App.keyCurrentlyDown, 0, sizeof(g_App.keyCurrentlyDown));
                memset(g_App.asyncPolledDown, 0, sizeof(g_App.asyncPolledDown));
                g_App.activeVirtualKeyDown = -1;
                g_App.totalKeyPresses = 0;
                g_App.currentRolloverCount = 0;
                g_App.peakRolloverCount = 0;
                g_App.lastVkCode = 0;
                g_App.lastScanCode = 0;
                g_App.lastKeyLabel[0] = L'\0';
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
        } else if (g_App.currentTab == TAB_MOUSE) {
            if (PtInRect(&g_App.rcBtnDisableMouse, pt)) {
                g_App.disableMouse = !g_App.disableMouse;
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnResetMouse, pt)) {
                for (int i = 0; i < 5; ++i) {
                    g_App.mouseClickCount[i] = 0;
                    g_App.mouseDoubleClickFaults[i] = 0;
                    g_App.lastClickDeltaMs[i] = 0.0;
                    g_App.lastClickTick[i] = 0;
                }
                g_App.scrollUpSteps = 0;
                g_App.scrollDownSteps = 0;
                g_App.scrollCumulativePos = 0;
                g_App.scrollEncoderGlitches = 0;
                g_App.lastScrollDirection = 0;
                g_App.scrollRingHead = 0;
                g_App.scrollRingCount = 0;
                g_App.mouseLogCount = 0;
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            RecordMouseButtonEvent(0, L"Left Button", true);
        } else if (g_App.currentTab == TAB_SPEAKER) {
            if (PtInRect(&g_App.rcBtnPlayToggle, pt)) {
                if (g_App.speakerPlaying) StopAudioPlayback();
                else StartAudioPlayback();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnModeSweep, pt)) {
                g_App.speakerMode = SPK_MODE_SWEEP;
                g_App.sweepProgress = 0.0;
                SaveAppSettings();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnModeFixed, pt)) {
                g_App.speakerMode = SPK_MODE_FIXED;
                g_App.currentFreqHz = g_App.fixedFreqHz;
                SaveAppSettings();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnModeSynth, pt)) {
                g_App.speakerMode = SPK_MODE_SYNTH;
                SaveAppSettings();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnChanLeft, pt)) {
                g_App.channelBalance = -1.0f;
                SaveAppSettings();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnChanCenter, pt)) {
                g_App.channelBalance = 0.0f;
                SaveAppSettings();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcBtnChanRight, pt)) {
                g_App.channelBalance = 1.0f;
                SaveAppSettings();
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            if (PtInRect(&g_App.rcSliderFreq, pt)) {
                g_App.draggingFreqSlider = true;
                SetCapture(hwnd);
                UpdateSpeakerSlidersFromMouse(pt.x);
                return 0;
            }
            if (PtInRect(&g_App.rcSliderBalance, pt)) {
                g_App.draggingBalanceSlider = true;
                SetCapture(hwnd);
                UpdateSpeakerSlidersFromMouse(pt.x);
                return 0;
            }
            if (PtInRect(&g_App.rcSliderVolume, pt)) {
                g_App.draggingVolumeSlider = true;
                SetCapture(hwnd);
                UpdateSpeakerSlidersFromMouse(pt.x);
                return 0;
            }
        }
        return 0;
    }

    case WM_LBUTTONUP: {
        if (g_App.draggingFreqSlider || g_App.draggingBalanceSlider || g_App.draggingVolumeSlider) {
            g_App.draggingFreqSlider = false;
            g_App.draggingBalanceSlider = false;
            g_App.draggingVolumeSlider = false;
            ReleaseCapture();
            SaveAppSettings();
        }
        if (g_App.currentTab == TAB_MOUSE) {
            RecordMouseButtonEvent(0, L"Left Button", false);
        }
        return 0;
    }

    case WM_MOUSEMOVE: {
        if (g_App.draggingFreqSlider || g_App.draggingBalanceSlider || g_App.draggingVolumeSlider) {
            UpdateSpeakerSlidersFromMouse((short)LOWORD(lParam));
        }
        return 0;
    }

    case WM_RBUTTONDOWN:
        if (g_App.currentTab == TAB_MOUSE) RecordMouseButtonEvent(1, L"Right Button", true);
        return 0;
    case WM_RBUTTONUP:
        if (g_App.currentTab == TAB_MOUSE) RecordMouseButtonEvent(1, L"Right Button", false);
        return 0;

    case WM_MBUTTONDOWN:
        if (g_App.currentTab == TAB_MOUSE) RecordMouseButtonEvent(2, L"Middle Button", true);
        return 0;
    case WM_MBUTTONUP:
        if (g_App.currentTab == TAB_MOUSE) RecordMouseButtonEvent(2, L"Middle Button", false);
        return 0;

    case WM_XBUTTONDOWN: {
        if (g_App.currentTab == TAB_MOUSE) {
            WORD xBtn = HIWORD(wParam);
            if (xBtn == XBUTTON1) RecordMouseButtonEvent(3, L"Side Back (X1)", true);
            else if (xBtn == XBUTTON2) RecordMouseButtonEvent(4, L"Side Forward (X2)", true);
        }
        return TRUE;
    }
    case WM_XBUTTONUP: {
        if (g_App.currentTab == TAB_MOUSE) {
            WORD xBtn = HIWORD(wParam);
            if (xBtn == XBUTTON1) RecordMouseButtonEvent(3, L"Side Back (X1)", false);
            else if (xBtn == XBUTTON2) RecordMouseButtonEvent(4, L"Side Forward (X2)", false);
        }
        return TRUE;
    }

    case WM_MOUSEWHEEL: {
        if (g_App.currentTab == TAB_MOUSE) {
            short delta = GET_WHEEL_DELTA_WPARAM(wParam);
            RecordMouseWheelEvent(delta);
        }
        return 0;
    }

    case WM_DESTROY: {
        SaveAppSettings();
        KillTimer(hwnd, 1);
        ShutdownAudioEngine();
        ReleaseGdiCache();
        PostQuitMessage(0);
        return 0;
    }
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

// ============================================================================
// Application Entry Point (WinMain)
// ============================================================================
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    (void)hPrevInstance;
    (void)lpCmdLine;

    HMODULE hUser32 = GetModuleHandleW(L"user32.dll");
    if (hUser32) {
        typedef BOOL(WINAPI* PFN_SetProcessDpiAwarenessContext)(DPI_AWARENESS_CONTEXT);
        PFN_SetProcessDpiAwarenessContext pSetDpi =
            (PFN_SetProcessDpiAwarenessContext)GetProcAddress(hUser32, "SetProcessDpiAwarenessContext");
        if (pSetDpi) {
            pSetDpi(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        }
    }

    INITCOMMONCONTROLSEX icex = {};
    icex.dwSize = sizeof(icex);
    icex.dwICC = ICC_STANDARD_CLASSES | ICC_BAR_CLASSES;
    InitCommonControlsEx(&icex);

    g_hKeyboardHook = SetWindowsHookExW(WH_KEYBOARD_LL, LowLevelKeyboardProc, hInstance, 0);
    g_hMouseHook    = SetWindowsHookExW(WH_MOUSE_LL, LowLevelMouseProc, hInstance, 0);

    HICON hAppIconBig   = CreateKeyboardAppIcon(32);
    HICON hAppIconSmall = CreateKeyboardAppIcon(16);

    WNDCLASSEXW wc = {};
    wc.cbSize        = sizeof(WNDCLASSEXW);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInstance;
    wc.hCursor       = LoadCursorW(NULL, IDC_ARROW);
    wc.hIcon         = hAppIconBig;
    wc.hIconSm       = hAppIconSmall;
    wc.lpszClassName = L"Win32HardwareDiagnosticsClass";
    RegisterClassExW(&wc);

    InitSettingsFilePath();
    UINT initDpi = 96;
    if (hUser32) {
        typedef UINT(WINAPI* PFN_GetDpiForSystem)(void);
        PFN_GetDpiForSystem pGetSysDpi = (PFN_GetDpiForSystem)GetProcAddress(hUser32, "GetDpiForSystem");
        if (pGetSysDpi) initDpi = pGetSysDpi();
    }
    int clientW = MulDiv(1280, initDpi, 96);
    int clientH = MulDiv(720, initDpi, 96);
    DWORD winStyle = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_VISIBLE;
    RECT rcWin = { 0, 0, clientW, clientH };
    AdjustWindowRectEx(&rcWin, winStyle, FALSE, 0);
    int fixedW = rcWin.right - rcWin.left;
    int fixedH = rcWin.bottom - rcWin.top;

    int screenW = GetSystemMetrics(SM_CXSCREEN);
    int screenH = GetSystemMetrics(SM_CYSCREEN);
    int defaultX = (screenW > fixedW) ? (screenW - fixedW) / 2 : 40;
    int defaultY = (screenH > fixedH) ? (screenH - fixedH) / 2 : 40;

    int savedX = (int)GetPrivateProfileIntW(L"Window", L"X", defaultX, g_App.settingsFilePath);
    int savedY = (int)GetPrivateProfileIntW(L"Window", L"Y", defaultY, g_App.settingsFilePath);
    if (savedX < 0 || savedX > screenW - 120) savedX = defaultX;
    if (savedY < 0 || savedY > screenH - 120) savedY = defaultY;

    HWND hwnd = CreateWindowExW(
        0,
        wc.lpszClassName,
        L"MKS-test v1.0 - Mouse | Keyboard | Speaker",
        winStyle,
        savedX, savedY, fixedW, fixedH,
        NULL, NULL, hInstance, NULL
    );

    if (!hwnd) return 1;

    ShowWindow(hwnd, SW_SHOWNORMAL);
    UpdateWindow(hwnd);
    SetForegroundWindow(hwnd);

    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (g_hKeyboardHook) UnhookWindowsHookEx(g_hKeyboardHook);
    if (g_hMouseHook)    UnhookWindowsHookEx(g_hMouseHook);

    return (int)msg.wParam;
}
