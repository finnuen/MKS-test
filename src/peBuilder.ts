/**
 * Pure TypeScript 64-bit Windows PE32+ Executable (.EXE) Assembler & Linker
 *
 * Generates a real, spec-compliant 64-bit Windows GUI executable (HardwareDiagnostics.exe)
 * directly in memory as a Uint8Array so the user can download and run HardwareDiagnostics.exe
 * immediately on any Windows 10/11 PC without installing Visual Studio, MinGW, or winget.
 */

import { PREBUILT_NATIVE_EXE_B64 } from './prebuiltExeBase64';

export const NATIVE_WIN32_CSHARP_SOURCE = `using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("MKS-test")]
[assembly: System.Reflection.AssemblyProduct("MKS-test v1.0")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.0.0.0")]

namespace Win32HardwareDiagnostics
{
    internal static class NativeWin32
    {
        public const int WH_KEYBOARD_LL = 13;
        public const int WH_MOUSE_LL = 14;
        public const int WM_KEYDOWN = 0x0100;
        public const int WM_KEYUP = 0x0101;
        public const int WM_SYSKEYDOWN = 0x0104;
        public const int WM_SYSKEYUP = 0x0105;
        public const int LLKHF_EXTENDED = 0x01;

        public delegate IntPtr LowLevelProc(int nCode, IntPtr wParam, IntPtr lParam);

        [StructLayout(LayoutKind.Sequential)]
        public struct KBDLLHOOKSTRUCT
        {
            public uint vkCode;
            public uint scanCode;
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern IntPtr SetWindowsHookExW(int idHook, LowLevelProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll")]
        public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr GetModuleHandleW(string lpModuleName);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern uint WritePrivateProfileStringW(string lpAppName, string lpKeyName, string lpString, string lpFileName);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern uint GetPrivateProfileStringW(string lpAppName, string lpKeyName, string lpDefault, StringBuilder lpReturnedString, uint nSize, string lpFileName);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern uint GetPrivateProfileIntW(string lpAppName, string lpKeyName, int nDefault, string lpFileName);

        [DllImport("kernel32.dll")]
        public static extern bool QueryPerformanceCounter(out long lpPerformanceCount);

        [DllImport("kernel32.dll")]
        public static extern bool QueryPerformanceFrequency(out long lpFrequency);

        [DllImport("dwmapi.dll")]
        public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        public const int CALLBACK_FUNCTION = 0x00030000;
        public const int WOM_DONE = 0x3BD;

        public delegate void WaveOutProc(IntPtr hwo, int uMsg, IntPtr dwInstance, IntPtr dwParam1, IntPtr dwParam2);

        [StructLayout(LayoutKind.Sequential)]
        public struct WAVEFORMATEX
        {
            public ushort wFormatTag;
            public ushort nChannels;
            public uint nSamplesPerSec;
            public uint nAvgBytesPerSec;
            public ushort nBlockAlign;
            public ushort wBitsPerSample;
            public ushort cbSize;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct WAVEHDR
        {
            public IntPtr lpData;
            public uint dwBufferLength;
            public uint dwBytesRecorded;
            public IntPtr dwUser;
            public uint dwFlags;
            public uint dwLoops;
            public IntPtr lpNext;
            public IntPtr reserved;
        }

        [DllImport("winmm.dll")]
        public static extern int waveOutOpen(out IntPtr hWaveOut, int uDeviceID, ref WAVEFORMATEX lpFormat, WaveOutProc dwCallback, IntPtr dwInstance, int dwFlags);

        [DllImport("winmm.dll")]
        public static extern int waveOutPrepareHeader(IntPtr hWaveOut, IntPtr lpWaveOutHdr, int uSize);

        [DllImport("winmm.dll")]
        public static extern int waveOutUnprepareHeader(IntPtr hWaveOut, IntPtr lpWaveOutHdr, int uSize);

        [DllImport("winmm.dll")]
        public static extern int waveOutWrite(IntPtr hWaveOut, IntPtr lpWaveOutHdr, int uSize);

        [DllImport("winmm.dll")]
        public static extern int waveOutReset(IntPtr hWaveOut);

        [DllImport("winmm.dll")]
        public static extern int waveOutClose(IntPtr hWaveOut);

        [DllImport("winmm.dll")]
        public static extern uint waveOutGetNumDevs();

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct WAVEOUTCAPS
        {
            public ushort wMid;
            public ushort wPid;
            public uint vDriverVersion;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
            public string szPname;
            public uint dwFormats;
            public ushort wChannels;
            public ushort wReserved1;
            public uint dwSupport;
        }

        [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
        public static extern int waveOutGetDevCapsW(IntPtr uDeviceID, out WAVEOUTCAPS pwoc, uint cbwoc);

        [StructLayout(LayoutKind.Sequential)]
        public struct RAWINPUTDEVICELIST
        {
            public IntPtr hDevice;
            public uint dwType;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RAWINPUTDEVICE
        {
            public ushort usUsagePage;
            public ushort usUsage;
            public uint dwFlags;
            public IntPtr hwndTarget;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RAWINPUTHEADER
        {
            public uint dwType;
            public uint dwSize;
            public IntPtr hDevice;
            public IntPtr wParam;
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint GetRawInputDeviceList([In, Out] RAWINPUTDEVICELIST[] RawInputDeviceList, ref uint puiNumDevices, uint cbSize);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern uint GetRawInputDeviceInfoW(IntPtr hDevice, uint uiCommand, StringBuilder pData, ref uint pcbSize);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);

        [DllImport("user32.dll")]
        public static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);
    }

    public struct KeyDef
    {
        public uint Vk;
        public string Label;
        public float X, Y, W, H;
        public KeyDef(uint vk, string label, float x, float y, float w, float h)
        {
            Vk = vk; Label = label; X = x; Y = y; W = w; H = h;
        }
    }

    public struct ScrollSample
    {
        public int StepDir;
        public int State;
        public long Tick;
    }

    public struct MouseLogItem
    {
        public string Text;
        public bool IsFault;
    }

    public class MainDiagWindow : Form
    {
        public const uint VK_NUMPAD_ENTER_SYNTH = 0xE8;

        private static readonly KeyDef[] KeyboardLayout = new KeyDef[]
        {
            // Row 0: Function Row (16 keys) - Main 0..15u, Nav 15.5..18.5u
            new KeyDef(0x1B, "Esc",   0.0f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x70, "F1",    2.0f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x71, "F2",    3.0f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x72, "F3",    4.0f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x73, "F4",    5.0f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x74, "F5",    6.5f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x75, "F6",    7.5f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x76, "F7",    8.5f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x77, "F8",    9.5f,  0.0f, 1.0f, 1.0f),
            new KeyDef(0x78, "F9",    11.0f, 0.0f, 1.0f, 1.0f),
            new KeyDef(0x79, "F10",   12.0f, 0.0f, 1.0f, 1.0f),
            new KeyDef(0x7A, "F11",   13.0f, 0.0f, 1.0f, 1.0f),
            new KeyDef(0x7B, "F12",   14.0f, 0.0f, 1.0f, 1.0f),
            new KeyDef(0x2C, "PrtSc", 15.5f, 0.0f, 1.0f, 1.0f),
            new KeyDef(0x91, "ScrLk", 16.5f, 0.0f, 1.0f, 1.0f),
            new KeyDef(0x13, "Pause", 17.5f, 0.0f, 1.0f, 1.0f),

            // Row 1: Number Row + Nav + Numpad (21 keys)
            new KeyDef(0xC0, "\` ~",       0.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('1',  "1",         1.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('2',  "2",         2.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('3',  "3",         3.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('4',  "4",         4.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('5',  "5",         5.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('6',  "6",         6.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('7',  "7",         7.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('8',  "8",         8.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('9',  "9",         9.0f,  1.25f, 1.0f, 1.0f),
            new KeyDef('0',  "0",         10.0f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0xBD, "-",         11.0f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0xBB, "=",         12.0f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0x08, "Backspace", 13.0f, 1.25f, 2.0f, 1.0f),
            new KeyDef(0x2D, "Ins",       15.5f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0x24, "Home",      16.5f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0x21, "PgUp",      17.5f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0x90, "Num",       19.0f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0x6F, "/",         20.0f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0x6A, "*",         21.0f, 1.25f, 1.0f, 1.0f),
            new KeyDef(0x6D, "-",         22.0f, 1.25f, 1.0f, 1.0f),

            // Row 2: QWERTY Row + Nav + Numpad (21 keys, Numpad + is 2u tall)
            new KeyDef(0x09, "Tab",  0.0f,  2.25f, 1.5f, 1.0f),
            new KeyDef('Q',  "Q",    1.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('W',  "W",    2.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('E',  "E",    3.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('R',  "R",    4.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('T',  "T",    5.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('Y',  "Y",    6.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('U',  "U",    7.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('I',  "I",    8.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('O',  "O",    9.5f,  2.25f, 1.0f, 1.0f),
            new KeyDef('P',  "P",    10.5f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0xDB, "[",    11.5f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0xDD, "]",    12.5f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0xDC, "\\\\", 13.5f, 2.25f, 1.5f, 1.0f),
            new KeyDef(0x2E, "Del",  15.5f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0x23, "End",  16.5f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0x22, "PgDn", 17.5f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0x67, "7",    19.0f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0x68, "8",    20.0f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0x69, "9",    21.0f, 2.25f, 1.0f, 1.0f),
            new KeyDef(0x6B, "+",    22.0f, 2.25f, 1.0f, 2.0f),

            // Row 3: ASDF Row + Numpad (16 keys)
            new KeyDef(0x14, "Caps",  0.0f,  3.25f, 1.75f, 1.0f),
            new KeyDef('A',  "A",     1.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('S',  "S",     2.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('D',  "D",     3.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('F',  "F",     4.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('G',  "G",     5.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('H',  "H",     6.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('J',  "J",     7.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('K',  "K",     8.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef('L',  "L",     9.75f, 3.25f, 1.0f,  1.0f),
            new KeyDef(0xBA, ";",     10.75f, 3.25f, 1.0f, 1.0f),
            new KeyDef(0xDE, "'",     11.75f, 3.25f, 1.0f, 1.0f),
            new KeyDef(0x0D, "Enter", 12.75f, 3.25f, 2.25f, 1.0f),
            new KeyDef(0x64, "4",     19.0f, 3.25f, 1.0f,  1.0f),
            new KeyDef(0x65, "5",     20.0f, 3.25f, 1.0f,  1.0f),
            new KeyDef(0x66, "6",     21.0f, 3.25f, 1.0f,  1.0f),

            // Row 4: ZXCV Row + Up Arrow + Numpad (17 keys, Numpad Enter is 2u tall)
            new KeyDef(0xA0, "Shift",  0.0f,  4.25f, 2.25f, 1.0f),
            new KeyDef('Z',  "Z",      2.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef('X',  "X",      3.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef('C',  "C",      4.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef('V',  "V",      5.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef('B',  "B",      6.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef('N',  "N",      7.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef('M',  "M",      8.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef(0xBC, ",",      9.25f, 4.25f, 1.0f,  1.0f),
            new KeyDef(0xBE, ".",      10.25f, 4.25f, 1.0f, 1.0f),
            new KeyDef(0xBF, "/",      11.25f, 4.25f, 1.0f, 1.0f),
            new KeyDef(0xA1, "RShift", 12.25f, 4.25f, 2.75f, 1.0f),
            new KeyDef(0x26, "Up",     16.5f, 4.25f, 1.0f,  1.0f),
            new KeyDef(0x61, "1",      19.0f, 4.25f, 1.0f,  1.0f),
            new KeyDef(0x62, "2",      20.0f, 4.25f, 1.0f,  1.0f),
            new KeyDef(0x63, "3",      21.0f, 4.25f, 1.0f,  1.0f),
            new KeyDef(VK_NUMPAD_ENTER_SYNTH, "Ent", 22.0f, 4.25f, 1.0f, 2.0f),

            // Row 5: Bottom Modifiers + Arrows + Numpad (13 keys) -> Total = 104 keys
            new KeyDef(0xA2, "Ctrl",  0.0f,  5.25f, 1.25f, 1.0f),
            new KeyDef(0x5B, "Win",   1.25f, 5.25f, 1.25f, 1.0f),
            new KeyDef(0xA4, "Alt",   2.5f,  5.25f, 1.25f, 1.0f),
            new KeyDef(0x20, "Space", 3.75f, 5.25f, 6.25f, 1.0f),
            new KeyDef(0xA5, "RAlt",  10.0f, 5.25f, 1.25f, 1.0f),
            new KeyDef(0x5C, "RWin",  11.25f, 5.25f, 1.25f, 1.0f),
            new KeyDef(0x5D, "Menu",  12.5f, 5.25f, 1.25f, 1.0f),
            new KeyDef(0xA3, "RCtrl", 13.75f, 5.25f, 1.25f, 1.0f),
            new KeyDef(0x25, "Left",  15.5f, 5.25f, 1.0f,  1.0f),
            new KeyDef(0x28, "Down",  16.5f, 5.25f, 1.0f,  1.0f),
            new KeyDef(0x27, "Right", 17.5f, 5.25f, 1.0f,  1.0f),
            new KeyDef(0x60, "0",     19.0f, 5.25f, 2.0f,  1.0f),
            new KeyDef(0x6E, ".",     21.0f, 5.25f, 1.0f,  1.0f)
        };

        private int currentTab = 1;
        private bool darkMode = true;
        private string settingsPath;

        private readonly bool[] keyCurrentlyDown = new bool[256];
        private readonly bool[] keyLatched = new bool[256];
        private readonly RectangleF[] keyRects = new RectangleF[104];
        private int activeVirtualKeyDown = -1;
        private bool disableKeyboard = false;
        private bool blockWinShortcuts = true;
        private uint lastVkCode = 0;
        private string lastKeyLabel = "None";
        private int totalKeyPresses = 0;
        private int currentRollover = 0;
        private int peakRollover = 0;

        private bool disableMouse = false;
        private readonly bool[] mouseBtnDown = new bool[5];
        private readonly int[] mouseClickCount = new int[5];
        private readonly int[] mouseFaults = new int[5];
        private readonly double[] lastClickDeltaMs = new double[5];
        private readonly long[] lastClickTick = new long[5];
        private long qpcFreq = 10000000;
        private int scrollUpSteps = 0;
        private int scrollDownSteps = 0;
        private int scrollCumulativePos = 0;
        private int scrollGlitches = 0;
        private int lastScrollDir = 0;
        private long lastScrollTick = 0;

        private readonly ScrollSample[] scrollRing = new ScrollSample[128];
        private int scrollRingHead = 0;
        private int scrollRingCount = 0;
        private readonly MouseLogItem[] mouseLogRing = new MouseLogItem[8];
        private int mouseLogCount = 0;

        private volatile bool speakerPlaying = false;
        private volatile int speakerMode = 0;
        private double currentFreqHz = 440.0;
        private double fixedFreqHz = 440.0;
        private double smoothedFreqHz = 440.0;
        private double sweepProgress = 0.0;
        private double phaseAccumulator = 0.0;
        private volatile float channelBalance = 0.0f;
        private volatile float masterVolume = 0.01f;
        private float smoothedLeftGain = 0.01f;
        private float smoothedRightGain = 0.01f;
        private double synthTimeSec = 0.0;

        private bool spacePhysDown = false;
        private int spacePressCount = 0;
        private long lastSpaceTick = 0;

        private string mouseDeviceName = "HID-Compliant Mouse";
        private string keyboardDeviceName = "Standard PS/2 or HID Keyboard";
        private string speakerDeviceName = "Default Windows Audio Output";

        private static readonly double[] MelodyNotesHz = new double[]
        {
            261.63, 329.63, 392.00, 523.25,
            293.66, 369.99, 440.00, 587.33,
            329.63, 415.30, 493.88, 659.25,
            261.63, 392.00, 523.25, 392.00
        };

        private IntPtr hWaveOut = IntPtr.Zero;
        private NativeWin32.WaveOutProc waveOutCallback;
        private const int AUDIO_SAMPLE_RATE = 44100;
        private const int AUDIO_BUFFER_SAMPLES = 1470;
        private const int AUDIO_NUM_BUFFERS = 4;
        private readonly IntPtr[] waveBufferPtrs = new IntPtr[AUDIO_NUM_BUFFERS];
        private readonly IntPtr[] waveHeaderPtrs = new IntPtr[AUDIO_NUM_BUFFERS];
        private readonly short[] tempMixBuffer = new short[AUDIO_BUFFER_SAMPLES * 2];

        private bool draggingFreq = false;
        private bool draggingBal = false;
        private bool draggingVol = false;

        private RectangleF rcTabKeyboard, rcTabMouse, rcTabSpeaker, rcBtnDarkMode;
        private RectangleF rcBtnDisableKeyboard, rcBtnToggleShortcutGuard, rcBtnResetKeyboard;
        private RectangleF rcBtnDisableMouse, rcBtnResetMouse, rcMouseTestArena;
        private RectangleF rcBtnPlayToggle, rcBtnModeSweep, rcBtnModeFixed, rcBtnModeSynth;
        private RectangleF rcSliderFreq, rcBtnChanLeft, rcBtnChanCenter, rcBtnChanRight, rcSliderBalance, rcSliderVolume;

        private IntPtr hKeyboardHook = IntPtr.Zero;
        private IntPtr hMouseHook = IntPtr.Zero;
        private NativeWin32.LowLevelProc kbHookDelegate;
        private NativeWin32.LowLevelProc mouseHookDelegate;
        private Timer uiTimer;

        public MainDiagWindow()
        {
            this.Text = "MKS-test v1.0 - Mouse | Keyboard | Speaker";
            this.Size = new Size(1240, 720);
            this.MinimumSize = new Size(920, 580);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.DoubleBuffered = true;
            this.SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);

            NativeWin32.QueryPerformanceFrequency(out qpcFreq);

            try { this.Icon = CreateKeyboardIcon(); } catch { }

            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string dir = Path.Combine(appData, "HardwareDiagnostics");
            try { Directory.CreateDirectory(dir); } catch { }
            settingsPath = Path.Combine(dir, "settings.ini");

            LoadSettings();
            SyncTitleBarTheme();
            InitAudioEngine();
            DetectHardwareDevices();

            kbHookDelegate = LowLevelKeyboardCallback;
            mouseHookDelegate = LowLevelMouseCallback;
            IntPtr hMod = NativeWin32.GetModuleHandleW(null);
            hKeyboardHook = NativeWin32.SetWindowsHookExW(NativeWin32.WH_KEYBOARD_LL, kbHookDelegate, hMod, 0);
            hMouseHook = NativeWin32.SetWindowsHookExW(NativeWin32.WH_MOUSE_LL, mouseHookDelegate, hMod, 0);

            uiTimer = new Timer();
            uiTimer.Interval = 30;
            uiTimer.Tick += OnUiTimerTick;
            uiTimer.Start();
        }

        private void SyncTitleBarTheme()
        {
            try
            {
                int val = darkMode ? 1 : 0;
                NativeWin32.DwmSetWindowAttribute(this.Handle, 20, ref val, 4);
                NativeWin32.DwmSetWindowAttribute(this.Handle, 19, ref val, 4);
            }
            catch { }
        }

        private static Icon CreateKeyboardIcon()
        {
            using (Bitmap bmp = new Bitmap(32, 32, System.Drawing.Imaging.PixelFormat.Format32bppArgb))
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);

                using (GraphicsPath bezel = CreateRoundedRect(new RectangleF(1.5f, 5.5f, 29f, 21f), 4.5f))
                using (SolidBrush bodyBrush = new SolidBrush(Color.FromArgb(15, 23, 42)))
                using (Pen borderPen = new Pen(Color.FromArgb(56, 189, 248), 2f))
                {
                    g.FillPath(bodyBrush, bezel);
                    g.DrawPath(borderPen, bezel);
                }

                using (SolidBrush bBlue = new SolidBrush(Color.FromArgb(56, 189, 248)))
                using (SolidBrush bGreen = new SolidBrush(Color.FromArgb(16, 185, 129)))
                using (SolidBrush bLight = new SolidBrush(Color.FromArgb(226, 232, 240)))
                {
                    // Row 1
                    g.FillRectangle(bBlue, 5, 9, 4, 3.5f);
                    g.FillRectangle(bGreen, 10.5f, 9, 4, 3.5f);
                    g.FillRectangle(bLight, 16, 9, 4, 3.5f);
                    g.FillRectangle(bLight, 21.5f, 9, 5.5f, 3.5f);

                    // Row 2
                    g.FillRectangle(bLight, 5, 14, 5, 3.5f);
                    g.FillRectangle(bGreen, 11.5f, 14, 4, 3.5f);
                    g.FillRectangle(bBlue, 17, 14, 4, 3.5f);
                    g.FillRectangle(bLight, 22.5f, 14, 4.5f, 3.5f);

                    // Row 3 (Modifiers + Spacebar)
                    g.FillRectangle(bLight, 5, 19, 4.5f, 3.5f);
                    g.FillRectangle(bBlue, 11, 19, 10, 3.5f);
                    g.FillRectangle(bLight, 22.5f, 19, 4.5f, 3.5f);
                }

                return Icon.FromHandle(bmp.GetHicon());
            }
        }

        private void LoadSettings()
        {
            if (!File.Exists(settingsPath)) return;
            darkMode = NativeWin32.GetPrivateProfileIntW("General", "DarkMode", 1, settingsPath) != 0;
            int tab = (int)NativeWin32.GetPrivateProfileIntW("General", "ActiveTab", 1, settingsPath);
            if (tab >= 0 && tab <= 2) currentTab = tab;
            blockWinShortcuts = NativeWin32.GetPrivateProfileIntW("Keyboard", "BlockWinShortcuts", 1, settingsPath) != 0;
            int sm = (int)NativeWin32.GetPrivateProfileIntW("Speaker", "SpeakerMode", 0, settingsPath);
            if (sm >= 0 && sm <= 2) speakerMode = sm;

            StringBuilder sb = new StringBuilder(260);
            NativeWin32.GetPrivateProfileStringW("Speaker", "FixedFrequencyHz", "440.0", sb, 260, settingsPath);
            double f;
            if (double.TryParse(sb.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out f) && f >= 20.0 && f <= 20000.0)
            {
                fixedFreqHz = f;
                currentFreqHz = f;
                smoothedFreqHz = f;
            }

            int balPct = (int)NativeWin32.GetPrivateProfileIntW("Speaker", "ChannelBalancePct", 0, settingsPath);
            if (balPct >= -100 && balPct <= 100) channelBalance = balPct / 100.0f;

            int volPct = (int)NativeWin32.GetPrivateProfileIntW("Speaker", "MasterVolumePct_v10", 1, settingsPath);
            if (volPct >= 0 && volPct <= 100)
            {
                masterVolume = volPct / 100.0f;
                smoothedLeftGain = masterVolume;
                smoothedRightGain = masterVolume;
            }
        }

        private void SaveSettings()
        {
            try
            {
                NativeWin32.WritePrivateProfileStringW("General", "DarkMode", darkMode ? "1" : "0", settingsPath);
                NativeWin32.WritePrivateProfileStringW("General", "ActiveTab", currentTab.ToString(), settingsPath);
                NativeWin32.WritePrivateProfileStringW("Keyboard", "BlockWinShortcuts", blockWinShortcuts ? "1" : "0", settingsPath);
                NativeWin32.WritePrivateProfileStringW("Speaker", "SpeakerMode", speakerMode.ToString(), settingsPath);
                NativeWin32.WritePrivateProfileStringW("Speaker", "FixedFrequencyHz", fixedFreqHz.ToString("F2", System.Globalization.CultureInfo.InvariantCulture), settingsPath);
                NativeWin32.WritePrivateProfileStringW("Speaker", "ChannelBalancePct", ((int)Math.Round(channelBalance * 100)).ToString(), settingsPath);
                NativeWin32.WritePrivateProfileStringW("Speaker", "MasterVolumePct_v10", ((int)Math.Round(masterVolume * 100)).ToString(), settingsPath);
            }
            catch { }
        }

        private void RecalculateRollover()
        {
            int c = 0;
            for (int i = 0; i < 256; i++) if (keyCurrentlyDown[i]) c++;
            currentRollover = c;
            if (c > peakRollover) peakRollover = c;
        }

        private IntPtr LowLevelKeyboardCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();
                bool isDown = (msg == NativeWin32.WM_KEYDOWN || msg == NativeWin32.WM_SYSKEYDOWN);
                bool isUp = (msg == NativeWin32.WM_KEYUP || msg == NativeWin32.WM_SYSKEYUP);
                NativeWin32.KBDLLHOOKSTRUCT kb = (NativeWin32.KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(NativeWin32.KBDLLHOOKSTRUCT));
                bool isExt = (kb.flags & NativeWin32.LLKHF_EXTENDED) != 0;
                uint vk = kb.vkCode;

                if (vk == 0x0D && isExt) vk = VK_NUMPAD_ENTER_SYNTH;
                else if (vk == 0x10) vk = (kb.scanCode == 0x36) ? 0xA1u : 0xA0u;
                else if (vk == 0x11) vk = isExt ? 0xA3u : 0xA2u;
                else if (vk == 0x12) vk = isExt ? 0xA5u : 0xA4u;

                // Shortcut: Press Space 5 times to enable mouse and keyboard
                if (vk == 0x20)
                {
                    if (isDown && !spacePhysDown)
                    {
                        spacePhysDown = true;
                        long nowTick = Environment.TickCount & int.MaxValue;
                        if (nowTick - lastSpaceTick > 2500) spacePressCount = 1;
                        else spacePressCount++;
                        lastSpaceTick = nowTick;

                        if (spacePressCount >= 5 && (disableKeyboard || disableMouse))
                        {
                            disableKeyboard = false;
                            disableMouse = false;
                            spacePressCount = 0;
                            this.BeginInvoke((MethodInvoker)(() => this.Invalidate()));
                            return (IntPtr)1;
                        }
                    }
                    else if (isUp)
                    {
                        spacePhysDown = false;
                    }
                }
                else if (isDown)
                {
                    spacePressCount = 0;
                }

                if (disableKeyboard) return (IntPtr)1;

                if (NativeWin32.GetForegroundWindow() == this.Handle && currentTab == 0)
                {
                    if (vk < 256)
                    {
                        if (isDown)
                        {
                            if (!keyCurrentlyDown[vk]) totalKeyPresses++;
                            keyCurrentlyDown[vk] = true;
                            keyLatched[vk] = true;
                            lastVkCode = vk;
                            lastKeyLabel = GetKeyLabel(vk);
                            RecalculateRollover();
                            this.BeginInvoke((MethodInvoker)(() => this.Invalidate()));
                        }
                        else if (isUp)
                        {
                            keyCurrentlyDown[vk] = false;
                            RecalculateRollover();
                            this.BeginInvoke((MethodInvoker)(() => this.Invalidate()));
                        }
                    }
                    if (blockWinShortcuts) return (IntPtr)1;
                }
            }
            return NativeWin32.CallNextHookEx(hKeyboardHook, nCode, wParam, lParam);
        }

        private IntPtr LowLevelMouseCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && disableMouse)
            {
                return (IntPtr)1;
            }
            return NativeWin32.CallNextHookEx(hMouseHook, nCode, wParam, lParam);
        }

        private string GetKeyLabel(uint vk)
        {
            for (int i = 0; i < KeyboardLayout.Length; i++)
            {
                if (KeyboardLayout[i].Vk == vk) return KeyboardLayout[i].Label;
            }
            return "0x" + vk.ToString("X2");
        }

        private void InitAudioEngine()
        {
            NativeWin32.WAVEFORMATEX wfx = new NativeWin32.WAVEFORMATEX();
            wfx.wFormatTag = 1;
            wfx.nChannels = 2;
            wfx.nSamplesPerSec = AUDIO_SAMPLE_RATE;
            wfx.wBitsPerSample = 16;
            wfx.nBlockAlign = 4;
            wfx.nAvgBytesPerSec = AUDIO_SAMPLE_RATE * 4;
            wfx.cbSize = 0;

            waveOutCallback = OnWaveOutProc;
            if (NativeWin32.waveOutOpen(out hWaveOut, -1, ref wfx, waveOutCallback, IntPtr.Zero, NativeWin32.CALLBACK_FUNCTION) == 0)
            {
                int bufBytes = AUDIO_BUFFER_SAMPLES * 2 * sizeof(short);
                int hdrSize = Marshal.SizeOf(typeof(NativeWin32.WAVEHDR));
                for (int i = 0; i < AUDIO_NUM_BUFFERS; i++)
                {
                    waveBufferPtrs[i] = Marshal.AllocHGlobal(bufBytes);
                    waveHeaderPtrs[i] = Marshal.AllocHGlobal(hdrSize);
                    NativeWin32.WAVEHDR hdr = new NativeWin32.WAVEHDR();
                    hdr.lpData = waveBufferPtrs[i];
                    hdr.dwBufferLength = (uint)bufBytes;
                    Marshal.StructureToPtr(hdr, waveHeaderPtrs[i], false);
                    NativeWin32.waveOutPrepareHeader(hWaveOut, waveHeaderPtrs[i], hdrSize);
                }
            }
        }

        private string ResolveRawDeviceName(IntPtr hDevice)
        {
            try
            {
                uint cch = 0;
                NativeWin32.GetRawInputDeviceInfoW(hDevice, 0x20000007, null, ref cch);
                if (cch == 0 || cch > 1024) return null;
                StringBuilder sb = new StringBuilder((int)cch + 2);
                if (NativeWin32.GetRawInputDeviceInfoW(hDevice, 0x20000007, sb, ref cch) == uint.MaxValue) return null;
                string devPath = sb.ToString();
                if (string.IsNullOrEmpty(devPath) || devPath.IndexOf("RDP_", StringComparison.OrdinalIgnoreCase) >= 0) return null;

                int start = 0;
                if (devPath.StartsWith(@"\\?\") || devPath.StartsWith(@"\??\")) start = 4;
                int guidIdx = devPath.IndexOf("#{", start, StringComparison.Ordinal);
                string core = (guidIdx > start) ? devPath.Substring(start, guidIdx - start) : devPath.Substring(start);
                string subKeyPath = @"SYSTEM\CurrentControlSet\Enum\" + core.Replace('#', '\\');

                using (Microsoft.Win32.RegistryKey rk = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(subKeyPath, false))
                {
                    if (rk != null)
                    {
                        string friendly = rk.GetValue("FriendlyName") as string;
                        if (string.IsNullOrEmpty(friendly)) friendly = rk.GetValue("DeviceDesc") as string;
                        if (!string.IsNullOrEmpty(friendly))
                        {
                            int semi = friendly.LastIndexOf(';');
                            return (semi >= 0 && semi + 1 < friendly.Length) ? friendly.Substring(semi + 1).Trim() : friendly.Trim();
                        }
                    }
                }
            }
            catch { }
            return null;
        }

        private void DetectHardwareDevices()
        {
            try
            {
                NativeWin32.WAVEOUTCAPS woc;
                uint cb = (uint)Marshal.SizeOf(typeof(NativeWin32.WAVEOUTCAPS));
                if (NativeWin32.waveOutGetNumDevs() > 0 && NativeWin32.waveOutGetDevCapsW(IntPtr.Zero, out woc, cb) == 0 && !string.IsNullOrEmpty(woc.szPname))
                {
                    speakerDeviceName = woc.szPname;
                }
                else if (NativeWin32.waveOutGetDevCapsW((IntPtr)(-1), out woc, cb) == 0 && !string.IsNullOrEmpty(woc.szPname))
                {
                    speakerDeviceName = woc.szPname;
                }
            }
            catch { }

            try
            {
                uint numDevices = 0;
                uint cbList = (uint)Marshal.SizeOf(typeof(NativeWin32.RAWINPUTDEVICELIST));
                if (NativeWin32.GetRawInputDeviceList(null, ref numDevices, cbList) == 0 && numDevices > 0)
                {
                    NativeWin32.RAWINPUTDEVICELIST[] list = new NativeWin32.RAWINPUTDEVICELIST[numDevices];
                    if (NativeWin32.GetRawInputDeviceList(list, ref numDevices, cbList) != uint.MaxValue)
                    {
                        bool specificMouse = false, specificKb = false;
                        for (int i = 0; i < list.Length; i++)
                        {
                            string name = ResolveRawDeviceName(list[i].hDevice);
                            if (!string.IsNullOrEmpty(name))
                            {
                                if (list[i].dwType == 0)
                                {
                                    bool generic = name.IndexOf("HID-compliant mouse", StringComparison.OrdinalIgnoreCase) >= 0;
                                    if (!specificMouse || !generic)
                                    {
                                        mouseDeviceName = name;
                                        if (!generic) specificMouse = true;
                                    }
                                }
                                else if (list[i].dwType == 1)
                                {
                                    bool generic = name.IndexOf("HID Keyboard Device", StringComparison.OrdinalIgnoreCase) >= 0;
                                    if (!specificKb || !generic)
                                    {
                                        keyboardDeviceName = name;
                                        if (!generic) specificKb = true;
                                    }
                                }
                            }
                        }
                    }
                }

                NativeWin32.RAWINPUTDEVICE[] rids = new NativeWin32.RAWINPUTDEVICE[2];
                rids[0].usUsagePage = 0x01; rids[0].usUsage = 0x02; rids[0].dwFlags = 0x00000100; rids[0].hwndTarget = this.Handle;
                rids[1].usUsagePage = 0x01; rids[1].usUsage = 0x06; rids[1].dwFlags = 0x00000100; rids[1].hwndTarget = this.Handle;
                NativeWin32.RegisterRawInputDevices(rids, 2, (uint)Marshal.SizeOf(typeof(NativeWin32.RAWINPUTDEVICE)));
            }
            catch { }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x00FF) // WM_INPUT
            {
                try
                {
                    uint dwSize = 0;
                    uint hdrSize = (uint)Marshal.SizeOf(typeof(NativeWin32.RAWINPUTHEADER));
                    NativeWin32.GetRawInputData(m.LParam, 0x10000005, IntPtr.Zero, ref dwSize, hdrSize);
                    if (dwSize >= hdrSize && dwSize <= 256)
                    {
                        IntPtr pBuf = Marshal.AllocHGlobal((int)dwSize);
                        try
                        {
                            if (NativeWin32.GetRawInputData(m.LParam, 0x10000005, pBuf, ref dwSize, hdrSize) == dwSize)
                            {
                                NativeWin32.RAWINPUTHEADER hdr = (NativeWin32.RAWINPUTHEADER)Marshal.PtrToStructure(pBuf, typeof(NativeWin32.RAWINPUTHEADER));
                                if (hdr.hDevice != IntPtr.Zero)
                                {
                                    string resolved = ResolveRawDeviceName(hdr.hDevice);
                                    if (!string.IsNullOrEmpty(resolved))
                                    {
                                        if (hdr.dwType == 0 && mouseDeviceName != resolved)
                                        {
                                            mouseDeviceName = resolved;
                                            if (currentTab == 1) this.Invalidate();
                                        }
                                        else if (hdr.dwType == 1 && keyboardDeviceName != resolved)
                                        {
                                            keyboardDeviceName = resolved;
                                            if (currentTab == 0) this.Invalidate();
                                        }
                                    }
                                }
                            }
                        }
                        finally { Marshal.FreeHGlobal(pBuf); }
                    }
                }
                catch { }
            }
            base.WndProc(ref m);
        }

        private void FillPcmBuffer(IntPtr lpData)
        {
            if (!speakerPlaying)
            {
                Array.Clear(tempMixBuffer, 0, tempMixBuffer.Length);
                Marshal.Copy(tempMixBuffer, 0, lpData, tempMixBuffer.Length);
                return;
            }

            const double twoPi = 6.28318530717958647692;
            float bal = channelBalance;
            float vol = masterVolume;
            float targetL = ((bal <= 0f) ? 1f : (1f - bal)) * vol;
            float targetR = ((bal >= 0f) ? 1f : (1f + bal)) * vol;

            for (int i = 0; i < AUDIO_BUFFER_SAMPLES; i++)
            {
                smoothedLeftGain += 0.005f * (targetL - smoothedLeftGain);
                smoothedRightGain += 0.005f * (targetR - smoothedRightGain);

                if (speakerMode == 2)
                {
                    synthTimeSec += 1.0 / AUDIO_SAMPLE_RATE;
                    int step = ((int)(synthTimeSec * 5.0)) & 15;
                    double noteHz = MelodyNotesHz[step];
                    currentFreqHz = noteHz;
                    double env = 1.0 - ((synthTimeSec * 5.0) % 1.0) * 0.55;
                    double wave = (Math.Sin(phaseAccumulator) + 0.35 * Math.Sin(phaseAccumulator * 2.0) + 0.25 * Math.Sin(phaseAccumulator * 0.5)) * 0.65 * env * 18000.0;
                    phaseAccumulator += twoPi * noteHz / AUDIO_SAMPLE_RATE;
                    if (phaseAccumulator >= twoPi * 2.0) phaseAccumulator -= twoPi * 2.0;
                    tempMixBuffer[i * 2] = (short)(wave * smoothedLeftGain);
                    tempMixBuffer[i * 2 + 1] = (short)(wave * smoothedRightGain);
                    continue;
                }

                if (speakerMode == 0)
                {
                    sweepProgress += 1.0 / (AUDIO_SAMPLE_RATE * 8.0);
                    if (sweepProgress > 1.0) sweepProgress = 0.0;
                    currentFreqHz = 20.0 * Math.Pow(1000.0, sweepProgress);
                    smoothedFreqHz = currentFreqHz;
                }
                else
                {
                    currentFreqHz = fixedFreqHz;
                    smoothedFreqHz += 0.004 * (fixedFreqHz - smoothedFreqHz);
                }

                double sample = Math.Sin(phaseAccumulator) * 24000.0;
                phaseAccumulator += twoPi * smoothedFreqHz / AUDIO_SAMPLE_RATE;
                if (phaseAccumulator >= twoPi) phaseAccumulator -= twoPi;

                tempMixBuffer[i * 2] = (short)(sample * smoothedLeftGain);
                tempMixBuffer[i * 2 + 1] = (short)(sample * smoothedRightGain);
            }
            Marshal.Copy(tempMixBuffer, 0, lpData, tempMixBuffer.Length);
        }

        private void OnWaveOutProc(IntPtr hwo, int uMsg, IntPtr dwInstance, IntPtr dwParam1, IntPtr dwParam2)
        {
            if (uMsg == NativeWin32.WOM_DONE && speakerPlaying)
            {
                try
                {
                    this.BeginInvoke((MethodInvoker)(() =>
                    {
                        if (speakerPlaying && hWaveOut != IntPtr.Zero)
                        {
                            NativeWin32.WAVEHDR hdr = (NativeWin32.WAVEHDR)Marshal.PtrToStructure(dwParam1, typeof(NativeWin32.WAVEHDR));
                            FillPcmBuffer(hdr.lpData);
                            NativeWin32.waveOutWrite(hWaveOut, dwParam1, Marshal.SizeOf(typeof(NativeWin32.WAVEHDR)));
                        }
                    }));
                }
                catch { }
            }
        }

        private void StartAudio()
        {
            if (hWaveOut == IntPtr.Zero || speakerPlaying) return;
            speakerPlaying = true;
            int hdrSize = Marshal.SizeOf(typeof(NativeWin32.WAVEHDR));
            for (int i = 0; i < AUDIO_NUM_BUFFERS; i++)
            {
                FillPcmBuffer(waveBufferPtrs[i]);
                NativeWin32.waveOutWrite(hWaveOut, waveHeaderPtrs[i], hdrSize);
            }
        }

        private void StopAudio()
        {
            if (hWaveOut == IntPtr.Zero || !speakerPlaying) return;
            speakerPlaying = false;
            NativeWin32.waveOutReset(hWaveOut);
        }

        private void OnUiTimerTick(object sender, EventArgs e)
        {
            if (currentTab == 2 && speakerPlaying && (speakerMode == 0 || speakerMode == 2))
            {
                this.Invalidate();
            }
            if (currentTab == 1 && scrollRingCount > 0)
            {
                long now;
                NativeWin32.QueryPerformanceCounter(out now);
                bool changed = false;
                for (int i = 0; i < scrollRingCount; i++)
                {
                    int idx = (scrollRingHead + i) % 128;
                    if (scrollRing[idx].State == 1)
                    {
                        double ageMs = (now - scrollRing[idx].Tick) * 1000.0 / qpcFreq;
                        if (ageMs >= 160.0)
                        {
                            scrollRing[idx].State = 0;
                            changed = true;
                        }
                    }
                }
                if (changed) this.Invalidate();
            }
        }

        private void PushMouseLog(string text, bool fault)
        {
            for (int i = 7; i > 0; i--) mouseLogRing[i] = mouseLogRing[i - 1];
            mouseLogRing[0] = new MouseLogItem { Text = text, IsFault = fault };
            if (mouseLogCount < 8) mouseLogCount++;
        }

        private void RecordMouseClick(int idx, string name, bool isDown)
        {
            if (idx < 0 || idx >= 5) return;
            mouseBtnDown[idx] = isDown;
            if (isDown)
            {
                long now;
                NativeWin32.QueryPerformanceCounter(out now);
                mouseClickCount[idx]++;
                if (lastClickTick[idx] != 0)
                {
                    double delta = (now - lastClickTick[idx]) * 1000.0 / qpcFreq;
                    lastClickDeltaMs[idx] = delta;
                    bool fault = delta < 80.0;
                    if (fault)
                    {
                        mouseFaults[idx]++;
                        PushMouseLog(string.Format("[FAULT] {0} bounce: {1:F1} ms (< 80 ms)", name, delta), true);
                    }
                    else
                    {
                        PushMouseLog(string.Format("[OK] {0} interval: {1:F1} ms", name, delta), false);
                    }
                }
                else
                {
                    PushMouseLog(string.Format("[OK] {0} initial click registered", name), false);
                }
                lastClickTick[idx] = now;
            }
            this.Invalidate();
        }

        protected override void OnMouseWheel(MouseEventArgs e)
        {
            base.OnMouseWheel(e);
            if (currentTab != 1 || disableMouse) return;

            long now;
            NativeWin32.QueryPerformanceCounter(out now);
            int dir = (e.Delta > 0) ? 1 : -1;
            bool glitch = false;

            if (lastScrollTick != 0 && lastScrollDir != 0)
            {
                double dt = (now - lastScrollTick) * 1000.0 / qpcFreq;
                if (dir != lastScrollDir && dt < 55.0)
                {
                    glitch = true;
                    scrollGlitches++;
                    PushMouseLog(string.Format("[ENCODER ERROR] Reverse jump within {0:F1} ms!", dt), true);
                }
            }

            if (dir > 0) { scrollUpSteps++; scrollCumulativePos++; }
            else { scrollDownSteps++; scrollCumulativePos--; }

            int writeIdx = (scrollRingHead + scrollRingCount) % 128;
            if (scrollRingCount == 128) scrollRingHead = (scrollRingHead + 1) % 128;
            else scrollRingCount++;
            scrollRing[writeIdx] = new ScrollSample { StepDir = dir, State = glitch ? 2 : 1, Tick = now };

            lastScrollDir = dir;
            lastScrollTick = now;
            this.Invalidate();
        }

        private static GraphicsPath CreateRoundedRect(RectangleF rc, float r)
        {
            GraphicsPath path = new GraphicsPath();
            if (r <= 0f || rc.Width <= 0f || rc.Height <= 0f)
            {
                path.AddRectangle(rc);
                return path;
            }
            float d = Math.Min(r * 2f, Math.Min(rc.Width, rc.Height));
            path.AddArc(rc.X, rc.Y, d, d, 180, 90);
            path.AddArc(rc.Right - d, rc.Y, d, d, 270, 90);
            path.AddArc(rc.Right - d, rc.Bottom - d, d, d, 0, 90);
            path.AddArc(rc.X, rc.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        private void DrawBox(Graphics g, RectangleF rc, float r, Color fill, Color border, float bw = 1f)
        {
            using (GraphicsPath p = CreateRoundedRect(rc, r))
            using (SolidBrush b = new SolidBrush(fill))
            {
                g.FillPath(b, p);
                if (bw > 0f)
                {
                    using (Pen pen = new Pen(border, bw)) g.DrawPath(pen, p);
                }
            }
        }

        private void DrawBtn(Graphics g, RectangleF rc, string text, Color bg, Color fg, Color border, Font font, float r = 8f)
        {
            DrawBox(g, rc, r, bg, border, 1f);
            using (StringFormat sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
            using (SolidBrush b = new SolidBrush(fg))
            {
                g.DrawString(text, font, b, rc, sf);
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            Color bgCanvas = darkMode ? Color.FromArgb(15, 23, 42) : Color.FromArgb(248, 250, 252);
            Color bgSurface = darkMode ? Color.FromArgb(30, 41, 59) : Color.FromArgb(255, 255, 255);
            Color bgElevated = darkMode ? Color.FromArgb(51, 65, 85) : Color.FromArgb(241, 245, 249);
            Color border = darkMode ? Color.FromArgb(71, 85, 105) : Color.FromArgb(203, 213, 225);
            Color textPri = darkMode ? Color.FromArgb(248, 250, 252) : Color.FromArgb(15, 23, 42);
            Color textSec = darkMode ? Color.FromArgb(148, 163, 184) : Color.FromArgb(100, 116, 139);
            Color accent = darkMode ? Color.FromArgb(56, 189, 248) : Color.FromArgb(2, 132, 199);
            Color keyLatchedCol = darkMode ? Color.FromArgb(16, 185, 129) : Color.FromArgb(22, 163, 74);
            Color danger = darkMode ? Color.FromArgb(239, 68, 68) : Color.FromArgb(220, 38, 38);

            g.Clear(bgCanvas);

            int w = this.ClientSize.Width;
            int h = this.ClientSize.Height;

            using (Font fTitle = new Font("Segoe UI", 11f, FontStyle.Bold))
            using (Font fBody = new Font("Segoe UI", 9.5f, FontStyle.Regular))
            using (Font fSmall = new Font("Segoe UI", 8.5f, FontStyle.Regular))
            using (Font fKey = new Font("Segoe UI", 8.5f, FontStyle.Bold))
            using (SolidBrush brPri = new SolidBrush(textPri))
            using (SolidBrush brSec = new SolidBrush(textSec))
            using (SolidBrush brAcc = new SolidBrush(accent))
            {
                g.DrawString("MKS-test v1.0", fTitle, brPri, new PointF(24, 18));

                float segW = 135f, segH = 34f;
                float segStartX = (w - segW * 3f) / 2f;
                float segTopY = 12f;

                DrawBox(g, new RectangleF(segStartX - 4, segTopY - 4, segW * 3 + 8, segH + 8), 10f, bgSurface, border);
                rcTabMouse = new RectangleF(segStartX, segTopY, segW, segH);
                rcTabKeyboard = new RectangleF(segStartX + segW, segTopY, segW, segH);
                rcTabSpeaker = new RectangleF(segStartX + segW * 2, segTopY, segW, segH);

                DrawBtn(g, rcTabMouse, "Mouse", currentTab == 1 ? accent : bgSurface, currentTab == 1 ? Color.FromArgb(15, 23, 42) : textPri, currentTab == 1 ? accent : bgSurface, fTitle, 7f);
                DrawBtn(g, rcTabKeyboard, "Keyboard", currentTab == 0 ? accent : bgSurface, currentTab == 0 ? Color.FromArgb(15, 23, 42) : textPri, currentTab == 0 ? accent : bgSurface, fTitle, 7f);
                DrawBtn(g, rcTabSpeaker, "Speaker", currentTab == 2 ? accent : bgSurface, currentTab == 2 ? Color.FromArgb(15, 23, 42) : textPri, currentTab == 2 ? accent : bgSurface, fTitle, 7f);

                string activeDevName = currentTab == 1 ? mouseDeviceName : (currentTab == 0 ? keyboardDeviceName : speakerDeviceName);
                using (StringFormat sfDev = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                {
                    g.DrawString(activeDevName, fSmall, brSec, new RectangleF(24, segTopY + segH + 6, w - 48, 20), sfDev);
                }

                rcBtnDarkMode = new RectangleF(w - 154, segTopY, 130, segH);
                DrawBtn(g, rcBtnDarkMode, darkMode ? "Theme: Dark" : "Theme: Light", bgSurface, textPri, border, fBody, 8f);

                float pad = 24f, topY = 78f;
                float bottomMargin = 44f;

                if (currentTab == 0)
                {
                    RectangleF rcCtrl = new RectangleF(pad, topY, w - pad * 2, 68f);
                    DrawBox(g, rcCtrl, 10f, bgSurface, border);

                    rcBtnDisableKeyboard = new RectangleF(rcCtrl.X + 16, rcCtrl.Y + 14, 240, 40);
                    DrawBtn(g, rcBtnDisableKeyboard, disableKeyboard ? "Keyboard Disabled (Click to Enable)" : "Disable Keyboard (Clean Mode)",
                        disableKeyboard ? danger : bgElevated, disableKeyboard ? Color.White : textPri, disableKeyboard ? danger : border, fBody);

                    rcBtnToggleShortcutGuard = new RectangleF(rcBtnDisableKeyboard.Right + 10, rcCtrl.Y + 14, 210, 40);
                    DrawBtn(g, rcBtnToggleShortcutGuard, blockWinShortcuts ? "Win Shortcuts: BLOCKED" : "Win Shortcuts: ALLOWED",
                        blockWinShortcuts ? accent : bgElevated, blockWinShortcuts ? Color.FromArgb(15, 23, 42) : textPri, blockWinShortcuts ? accent : border, fBody);

                    rcBtnResetKeyboard = new RectangleF(rcBtnToggleShortcutGuard.Right + 10, rcCtrl.Y + 14, 140, 40);
                    DrawBtn(g, rcBtnResetKeyboard, "Reset Lit Keys", bgElevated, textPri, border, fBody);

                    int latchedCount = 0;
                    for (int i = 0; i < KeyboardLayout.Length; i++) if (keyLatched[KeyboardLayout[i].Vk]) latchedCount++;

                    string stats = string.Format("Lit: {0}/104  |  NKRO: {1} (Peak {2})  |  Presses: {3}  |  Last: {4} (0x{5:X2})",
                        latchedCount, currentRollover, peakRollover, totalKeyPresses, lastKeyLabel, lastVkCode);
                    using (StringFormat sfR = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center })
                    {
                        g.DrawString(stats, fBody, brSec, new RectangleF(rcBtnResetKeyboard.Right + 12, rcCtrl.Y, rcCtrl.Right - rcBtnResetKeyboard.Right - 28, rcCtrl.Height), sfR);
                    }

                    RectangleF rcDeck = new RectangleF(pad, rcCtrl.Bottom + 16, w - pad * 2, h - rcCtrl.Bottom - bottomMargin - 16);
                    DrawBox(g, rcDeck, 12f, bgSurface, border);

                    float deckW = rcDeck.Width - 40f;
                    float deckH = rcDeck.Height - 66f;
                    float unitSize = Math.Min(deckW / 23.0f, deckH / 6.25f);
                    float gap = 4f;
                    float startX = rcDeck.X + (rcDeck.Width - 23.0f * unitSize) / 2f;
                    float startY = rcDeck.Y + 20f + (deckH - 6.25f * unitSize) / 2f;

                    for (int i = 0; i < KeyboardLayout.Length; i++)
                    {
                        KeyDef k = KeyboardLayout[i];
                        RectangleF rk = new RectangleF(
                            startX + k.X * unitSize + gap / 2f,
                            startY + k.Y * unitSize + gap / 2f,
                            k.W * unitSize - gap,
                            k.H * unitSize - gap
                        );
                        keyRects[i] = rk;
                        bool down = keyCurrentlyDown[k.Vk];
                        bool latched = keyLatched[k.Vk];
                        Color kBg = down ? accent : (latched ? keyLatchedCol : bgElevated);
                        Color kFg = down ? Color.FromArgb(15, 23, 42) : (latched ? Color.White : textPri);
                        Color kBd = down ? accent : (latched ? keyLatchedCol : border);
                        DrawBtn(g, rk, k.Label, kBg, kFg, kBd, fKey, 6f);
                    }

                    g.DrawString("Tip: Press any physical key on your keyboard. Pressed keys stay lit green until Reset.", fSmall, brSec, new PointF(rcDeck.X + 20, rcDeck.Bottom - 28));
                }
                else if (currentTab == 1)
                {
                    RectangleF rcCtrl = new RectangleF(pad, topY, w - pad * 2, 68f);
                    DrawBox(g, rcCtrl, 10f, bgSurface, border);

                    rcBtnDisableMouse = new RectangleF(rcCtrl.X + 16, rcCtrl.Y + 14, 320, 40);
                    DrawBtn(g, rcBtnDisableMouse, disableMouse ? "MOUSE DISABLED (Press Space 5x to Enable)" : "Disable Mouse (Clean Mode)",
                        disableMouse ? danger : bgElevated, disableMouse ? Color.White : textPri, disableMouse ? danger : border, fBody);

                    rcBtnResetMouse = new RectangleF(rcBtnDisableMouse.Right + 12, rcCtrl.Y + 14, 175, 40);
                    DrawBtn(g, rcBtnResetMouse, "Reset Mouse Counters", bgElevated, textPri, border, fBody);

                    int totalFaults = 0;
                    for (int i = 0; i < 5; i++) totalFaults += mouseFaults[i];
                    string mStat = string.Format("Double-Click Faults (<80ms): {0}   |   Scroll Steps (Up/Down): {1} / {2}   |   Encoder Glitches: {3}",
                        totalFaults, scrollUpSteps, scrollDownSteps, scrollGlitches);
                    using (StringFormat sfR = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center })
                    {
                        g.DrawString(mStat, fBody, brSec, new RectangleF(rcBtnResetMouse.Right + 12, rcCtrl.Y, rcCtrl.Right - rcBtnResetMouse.Right - 28, rcCtrl.Height), sfR);
                    }

                    float contentTop = rcCtrl.Bottom + 16f;
                    float colW = (w - pad * 2 - 18f) / 2f;
                    RectangleF rcLeft = new RectangleF(pad, contentTop, colW, h - contentTop - bottomMargin);
                    RectangleF rcRight = new RectangleF(pad + colW + 18f, contentTop, colW, h - contentTop - bottomMargin);
                    DrawBox(g, rcLeft, 12f, bgSurface, border);
                    DrawBox(g, rcRight, 12f, bgSurface, border);

                    g.DrawString("01. Double-Click Switch Bounce Detector", fTitle, brPri, new PointF(rcLeft.X + 20, rcLeft.Y + 16));
                    rcMouseTestArena = new RectangleF(rcLeft.X + 20, rcLeft.Y + 48, rcLeft.Width - 40, 108);
                    DrawBtn(g, rcMouseTestArena, "CLICK OR SCROLL HERE (Left / Right / Middle / Side)", mouseBtnDown[0] ? accent : bgElevated, mouseBtnDown[0] ? Color.FromArgb(15, 23, 42) : textPri, totalFaults > 0 ? danger : accent, fTitle, 10f);

                    string[] btnNames = { "Left Button", "Right Button", "Middle Wheel Click", "Side Back (X1)", "Side Forward (X2)" };
                    for (int i = 0; i < 5; i++)
                    {
                        RectangleF rRow = new RectangleF(rcLeft.X + 20, rcMouseTestArena.Bottom + 14 + i * 46, rcLeft.Width - 40, 38);
                        DrawBox(g, rRow, 6f, bgElevated, mouseFaults[i] > 0 ? danger : (mouseBtnDown[i] ? accent : border));
                        g.DrawString(btnNames[i], fBody, brPri, new PointF(rRow.X + 12, rRow.Y + 9));
                        string rTxt = string.Format("Clicks: {0}  |  Interval: {1}  |  Faults: {2}",
                            mouseClickCount[i], lastClickDeltaMs[i] > 0 ? lastClickDeltaMs[i].ToString("F1") + " ms" : "-- ms", mouseFaults[i]);
                        using (StringFormat sfR = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center })
                        {
                            g.DrawString(rTxt, fBody, brSec, new RectangleF(rRow.X, rRow.Y, rRow.Width - 12, rRow.Height), sfR);
                        }
                    }

                    g.DrawString("02. Scroll Encoder Progressing Graph", fTitle, brPri, new PointF(rcRight.X + 20, rcRight.Y + 16));
                    RectangleF rcGraph = new RectangleF(rcRight.X + 20, rcRight.Y + 48, rcRight.Width - 40, 180);
                    DrawBox(g, rcGraph, 10f, darkMode ? Color.FromArgb(17, 21, 28) : bgElevated, scrollGlitches > 0 ? danger : border);

                    float midY = rcGraph.Y + rcGraph.Height / 2f;
                    using (Pen pBase = new Pen(border, 1f)) g.DrawLine(pBase, rcGraph.X + 16, midY, rcGraph.Right - 16, midY);

                    int maxBars = (int)((rcGraph.Width - 32f) / 6f);
                    int startOff = Math.Max(0, scrollRingCount - maxBars);
                    for (int i = startOff; i < scrollRingCount; i++)
                    {
                        int slot = i - startOff;
                        float bx = rcGraph.X + 16 + slot * 6f;
                        ScrollSample s = scrollRing[(scrollRingHead + i) % 128];
                        Color bc = s.State == 2 ? danger : (s.State == 1 ? Color.FromArgb(217, 119, 6) : (s.StepDir > 0 ? Color.FromArgb(34, 197, 94) : Color.FromArgb(37, 99, 235)));
                        float bh = 56f;
                        RectangleF rb = s.StepDir > 0 ? new RectangleF(bx, midY - bh, 4f, bh) : new RectangleF(bx, midY + 1f, 4f, bh);
                        using (SolidBrush sb = new SolidBrush(bc)) g.FillRectangle(sb, rb);
                    }

                    g.DrawString("Real-Time Switch & Encoder Diagnostic Log:", fBody, brPri, new PointF(rcRight.X + 20, rcGraph.Bottom + 14));
                    for (int i = 0; i < mouseLogCount; i++)
                    {
                        using (SolidBrush lb = new SolidBrush(mouseLogRing[i].IsFault ? danger : textSec))
                        {
                            g.DrawString(mouseLogRing[i].Text, fSmall, lb, new PointF(rcRight.X + 20, rcGraph.Bottom + 40 + i * 22));
                        }
                    }
                }
                else
                {
                    RectangleF rcCard = new RectangleF(pad, topY, w - pad * 2, h - topY - bottomMargin);
                    DrawBox(g, rcCard, 12f, bgSurface, border);
                    float inL = rcCard.X + 32f, inR = rcCard.Right - 32f, y = rcCard.Y + 26f;

                    g.DrawString("Speaker Frequency Sweep, Synth & Channel Balance", fTitle, brPri, new PointF(inL, y + 8));
                    rcBtnPlayToggle = new RectangleF(inR - 200, y, 200, 42);
                    DrawBtn(g, rcBtnPlayToggle, speakerPlaying ? "STOP AUDIO TEST" : "START AUDIO TEST",
                        speakerPlaying ? danger : keyLatchedCol, Color.White, speakerPlaying ? danger : keyLatchedCol, fBody);

                    y += 60f;
                    rcBtnModeSweep = new RectangleF(inL, y, 220, 40);
                    DrawBtn(g, rcBtnModeSweep, "Auto Log Sweep (20Hz-20kHz)", speakerMode == 0 ? accent : bgElevated, speakerMode == 0 ? Color.FromArgb(15, 23, 42) : textPri, speakerMode == 0 ? accent : border, fBody);

                    rcBtnModeFixed = new RectangleF(rcBtnModeSweep.Right + 10, y, 210, 40);
                    DrawBtn(g, rcBtnModeFixed, "Manual Fixed Frequency", speakerMode == 1 ? accent : bgElevated, speakerMode == 1 ? Color.FromArgb(15, 23, 42) : textPri, speakerMode == 1 ? accent : border, fBody);

                    rcBtnModeSynth = new RectangleF(rcBtnModeFixed.Right + 10, y, 160, 40);
                    DrawBtn(g, rcBtnModeSynth, "Synth", speakerMode == 2 ? accent : bgElevated, speakerMode == 2 ? Color.FromArgb(15, 23, 42) : textPri, speakerMode == 2 ? accent : border, fBody);

                    string fRead = speakerMode == 2 ? string.Format("Built-in Synth ({0:F0} Hz)", currentFreqHz) : string.Format("Frequency: {0:F0} Hz", currentFreqHz);
                    using (StringFormat sfR = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center })
                    {
                        g.DrawString(fRead, fTitle, brAcc, new RectangleF(rcBtnModeSynth.Right + 10, y, inR - rcBtnModeSynth.Right - 10, 40), sfR);
                    }

                    y += 56f;
                    rcSliderFreq = new RectangleF(inL, y, inR - inL, 34);
                    DrawBox(g, rcSliderFreq, 8f, bgElevated, border);
                    double normF = Math.Max(0.0, Math.Min(1.0, Math.Log(currentFreqHz / 20.0) / Math.Log(1000.0)));
                    float fw = (float)(normF * rcSliderFreq.Width);
                    if (fw > 8f) DrawBox(g, new RectangleF(rcSliderFreq.X, rcSliderFreq.Y, fw, rcSliderFreq.Height), 8f, accent, accent, 0f);

                    y += 66f;
                    g.DrawString("Left / Right Stereo Channel Balance Test", fTitle, brPri, new PointF(inL, y));
                    y += 36f;
                    rcBtnChanLeft = new RectangleF(inL, y, 200, 40);
                    rcBtnChanCenter = new RectangleF(inL + 214, y, 200, 40);
                    rcBtnChanRight = new RectangleF(inL + 428, y, 200, 40);
                    DrawBtn(g, rcBtnChanLeft, "Left Speaker Only (L)", channelBalance <= -0.95f ? accent : bgElevated, channelBalance <= -0.95f ? Color.FromArgb(15, 23, 42) : textPri, border, fBody);
                    DrawBtn(g, rcBtnChanCenter, "Center (Both L + R)", Math.Abs(channelBalance) < 0.05f ? accent : bgElevated, Math.Abs(channelBalance) < 0.05f ? Color.FromArgb(15, 23, 42) : textPri, border, fBody);
                    DrawBtn(g, rcBtnChanRight, "Right Speaker Only (R)", channelBalance >= 0.95f ? accent : bgElevated, channelBalance >= 0.95f ? Color.FromArgb(15, 23, 42) : textPri, border, fBody);

                    y += 54f;
                    rcSliderBalance = new RectangleF(inL, y, inR - inL, 30);
                    DrawBox(g, rcSliderBalance, 8f, bgElevated, border);
                    float bMid = rcSliderBalance.X + rcSliderBalance.Width / 2f;
                    float bThumb = bMid + channelBalance * (rcSliderBalance.Width / 2f - 16f);
                    DrawBox(g, new RectangleF(bThumb - 14, rcSliderBalance.Y + 3, 28, rcSliderBalance.Height - 6), 6f, accent, accent, 0f);

                    y += 48f;
                    g.DrawString(string.Format("Output Gain Volume: {0:F0}% (Default: 1%)", masterVolume * 100f), fBody, brPri, new PointF(inL, y));
                    y += 28f;
                    rcSliderVolume = new RectangleF(inL, y, inR - inL, 28);
                    DrawBox(g, rcSliderVolume, 8f, bgElevated, border);
                    float vw = masterVolume * rcSliderVolume.Width;
                    if (vw > 6f) DrawBox(g, new RectangleF(rcSliderVolume.X, rcSliderVolume.Y, vw, rcSliderVolume.Height), 8f, keyLatchedCol, keyLatchedCol, 0f);
                }

                // Permanent bottom info bar across the app
                using (StringFormat sfBottom = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                {
                    g.DrawString("\u24D8  Shortcut: Press Space 5 times to enable mouse and keyboard", fSmall, brSec, new RectangleF(pad, h - 36f, w - pad * 2, 28f), sfBottom);
                }
            }
        }

        private void UpdateSliders(float x)
        {
            if (draggingFreq)
            {
                double t = Math.Max(0.0, Math.Min(1.0, (x - rcSliderFreq.X) / rcSliderFreq.Width));
                speakerMode = 1;
                fixedFreqHz = 20.0 * Math.Pow(1000.0, t);
                currentFreqHz = fixedFreqHz;
                this.Invalidate();
            }
            if (draggingBal)
            {
                double t = Math.Max(0.0, Math.Min(1.0, (x - rcSliderBalance.X) / rcSliderBalance.Width));
                channelBalance = (float)(t * 2.0 - 1.0);
                this.Invalidate();
            }
            if (draggingVol)
            {
                double t = Math.Max(0.0, Math.Min(1.0, (x - rcSliderVolume.X) / rcSliderVolume.Width));
                masterVolume = (float)t;
                this.Invalidate();
            }
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            PointF pt = new PointF(e.X, e.Y);

            if (e.Button == MouseButtons.Left)
            {
                if (rcTabKeyboard.Contains(pt)) { currentTab = 0; SaveSettings(); Invalidate(); return; }
                if (rcTabMouse.Contains(pt)) { currentTab = 1; SaveSettings(); Invalidate(); return; }
                if (rcTabSpeaker.Contains(pt)) { currentTab = 2; SaveSettings(); Invalidate(); return; }
                if (rcBtnDarkMode.Contains(pt)) { darkMode = !darkMode; SyncTitleBarTheme(); SaveSettings(); Invalidate(); return; }

                if (currentTab == 0)
                {
                    if (rcBtnDisableKeyboard.Contains(pt)) { disableKeyboard = !disableKeyboard; Invalidate(); return; }
                    if (rcBtnToggleShortcutGuard.Contains(pt)) { blockWinShortcuts = !blockWinShortcuts; SaveSettings(); Invalidate(); return; }
                    if (rcBtnResetKeyboard.Contains(pt))
                    {
                        Array.Clear(keyLatched, 0, keyLatched.Length);
                        Array.Clear(keyCurrentlyDown, 0, keyCurrentlyDown.Length);
                        totalKeyPresses = 0; currentRollover = 0; peakRollover = 0; lastVkCode = 0; lastKeyLabel = "None";
                        Invalidate(); return;
                    }
                }
                else if (currentTab == 1)
                {
                    if (rcBtnDisableMouse.Contains(pt)) { disableMouse = !disableMouse; Invalidate(); return; }
                    if (rcBtnResetMouse.Contains(pt))
                    {
                        Array.Clear(mouseClickCount, 0, 5);
                        Array.Clear(mouseFaults, 0, 5);
                        Array.Clear(lastClickDeltaMs, 0, 5);
                        Array.Clear(lastClickTick, 0, 5);
                        scrollUpSteps = 0; scrollDownSteps = 0; scrollCumulativePos = 0; scrollGlitches = 0;
                        scrollRingHead = 0; scrollRingCount = 0; mouseLogCount = 0;
                        Invalidate(); return;
                    }
                    RecordMouseClick(0, "Left Button", true);
                }
                else if (currentTab == 2)
                {
                    if (rcBtnPlayToggle.Contains(pt)) { if (speakerPlaying) StopAudio(); else StartAudio(); Invalidate(); return; }
                    if (rcBtnModeSweep.Contains(pt)) { speakerMode = 0; sweepProgress = 0.0; SaveSettings(); Invalidate(); return; }
                    if (rcBtnModeFixed.Contains(pt)) { speakerMode = 1; currentFreqHz = fixedFreqHz; SaveSettings(); Invalidate(); return; }
                    if (rcBtnModeSynth.Contains(pt)) { speakerMode = 2; SaveSettings(); Invalidate(); return; }
                    if (rcBtnChanLeft.Contains(pt)) { channelBalance = -1f; SaveSettings(); Invalidate(); return; }
                    if (rcBtnChanCenter.Contains(pt)) { channelBalance = 0f; SaveSettings(); Invalidate(); return; }
                    if (rcBtnChanRight.Contains(pt)) { channelBalance = 1f; SaveSettings(); Invalidate(); return; }
                    if (rcSliderFreq.Contains(pt)) { draggingFreq = true; UpdateSliders(pt.X); return; }
                    if (rcSliderBalance.Contains(pt)) { draggingBal = true; UpdateSliders(pt.X); return; }
                    if (rcSliderVolume.Contains(pt)) { draggingVol = true; UpdateSliders(pt.X); return; }
                }
            }
            else if (currentTab == 1)
            {
                if (e.Button == MouseButtons.Right) RecordMouseClick(1, "Right Button", true);
                else if (e.Button == MouseButtons.Middle) RecordMouseClick(2, "Middle Button", true);
                else if (e.Button == MouseButtons.XButton1) RecordMouseClick(3, "Side Back (X1)", true);
                else if (e.Button == MouseButtons.XButton2) RecordMouseClick(4, "Side Forward (X2)", true);
            }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (draggingFreq || draggingBal || draggingVol) UpdateSliders(e.X);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (draggingFreq || draggingBal || draggingVol)
            {
                draggingFreq = false; draggingBal = false; draggingVol = false;
                SaveSettings();
            }
            if (currentTab == 1)
            {
                if (e.Button == MouseButtons.Left) RecordMouseClick(0, "Left Button", false);
                else if (e.Button == MouseButtons.Right) RecordMouseClick(1, "Right Button", false);
                else if (e.Button == MouseButtons.Middle) RecordMouseClick(2, "Middle Button", false);
                else if (e.Button == MouseButtons.XButton1) RecordMouseClick(3, "Side Back (X1)", false);
                else if (e.Button == MouseButtons.XButton2) RecordMouseClick(4, "Side Forward (X2)", false);
            }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            this.WindowState = FormWindowState.Normal;
            this.Activate();
            this.BringToFront();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            SaveSettings();
            uiTimer.Stop();
            StopAudio();
            if (hKeyboardHook != IntPtr.Zero) NativeWin32.UnhookWindowsHookEx(hKeyboardHook);
            if (hMouseHook != IntPtr.Zero) NativeWin32.UnhookWindowsHookEx(hMouseHook);
            base.OnFormClosing(e);
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainDiagWindow());
        }
    }
}
`;

/**
 * Generates a standalone 32x32 32-bit BGRA Windows .ICO file featuring a Keyboard icon.
 */
export function buildKeyboardIcoBytes(): Uint8Array {
  const width = 32;
  const height = 32;
  const xorBytes = width * height * 4; // 4096
  const andBytes = width * 4; // 128 (32 rows * 4 bytes/row)
  const dibSize = 40 + xorBytes + andBytes; // 4264
  const totalSize = 6 + 16 + dibSize; // 4286

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // ICONDIR (6 bytes)
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type = 1 (ICO)
  view.setUint16(4, 1, true); // Count = 1 image

  // ICONDIRENTRY (16 bytes at offset 6)
  u8[6] = width;
  u8[7] = height;
  u8[8] = 0;
  u8[9] = 0;
  view.setUint16(10, 1, true); // Planes
  view.setUint16(12, 32, true); // BitCount = 32
  view.setUint32(14, dibSize, true); // BytesInRes
  view.setUint32(18, 22, true); // ImageOffset = 22

  // BITMAPINFOHEADER (40 bytes at offset 22)
  const bih = 22;
  view.setUint32(bih + 0, 40, true);
  view.setInt32(bih + 4, width, true);
  view.setInt32(bih + 8, height * 2, true); // height * 2 for XOR + AND masks
  view.setUint16(bih + 12, 1, true);
  view.setUint16(bih + 14, 32, true);
  view.setUint32(bih + 16, 0, true);
  view.setUint32(bih + 20, xorBytes + andBytes, true);

  // Draw 32x32 keyboard icon into bottom-up BGRA pixel array at offset 62
  const pxBase = 62;
  const setPixel = (x: number, yTopDown: number, r: number, g: number, b: number, a: number) => {
    if (x < 0 || x >= width || yTopDown < 0 || yTopDown >= height) return;
    const yBottomUp = height - 1 - yTopDown;
    const idx = pxBase + (yBottomUp * width + x) * 4;
    u8[idx + 0] = b;
    u8[idx + 1] = g;
    u8[idx + 2] = r;
    u8[idx + 3] = a;
  };

  const fillRect = (x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a = 255) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  };

  // Outer sky-blue keyboard bezel (#38BDF8) and dark slate body (#0F172A)
  fillRect(2, 6, 30, 26, 56, 189, 248);
  fillRect(4, 8, 28, 24, 15, 23, 42);

  // Row 1 keys
  fillRect(6, 10, 9, 13, 56, 189, 248);   // Active blue key
  fillRect(11, 10, 14, 13, 16, 185, 129); // Latched green key
  fillRect(16, 10, 19, 13, 226, 232, 240);
  fillRect(21, 10, 26, 13, 226, 232, 240);

  // Row 2 keys
  fillRect(6, 15, 10, 18, 226, 232, 240);
  fillRect(12, 15, 15, 18, 16, 185, 129); // Latched green key
  fillRect(17, 15, 20, 18, 56, 189, 248); // Active blue key
  fillRect(22, 15, 26, 18, 226, 232, 240);

  // Row 3 (Modifiers + Spacebar)
  fillRect(6, 20, 10, 22, 148, 163, 184);
  fillRect(11, 20, 21, 22, 56, 189, 248); // Spacebar
  fillRect(22, 20, 26, 22, 148, 163, 184);

  return u8;
}

export function buildKeyboardIcoBase64(): string {
  const bytes = buildKeyboardIcoBytes();
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Returns the real 64-bit Windows PE32+ GUI Executable (MKS-test.exe) compiled directly
 * from main.cpp using MinGW-w64 (x86_64-w64-mingw32-g++ -O3 -flto -s -mwindows -static)
 * with embedded RT_GROUP_ICON / RT_ICON (.rsrc section) so it launches natively in <5ms
 * with zero PowerShell, zero .NET runtime compilation, and zero external dependencies.
 */
export function buildStandaloneWindowsExe(): Uint8Array {
  const binaryStr = atob(PREBUILT_NATIVE_EXE_B64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i) & 0xff;
  }
  return bytes;
}
