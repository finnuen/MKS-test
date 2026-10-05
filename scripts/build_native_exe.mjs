import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function buildKeyboardIcoBytes() {
  const width = 32;
  const height = 32;
  const xorBytes = width * height * 4;
  const andBytes = width * 4;
  const dibSize = 40 + xorBytes + andBytes;
  const totalSize = 6 + 16 + dibSize;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);

  u8[6] = width;
  u8[7] = height;
  u8[8] = 0;
  u8[9] = 0;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, dibSize, true);
  view.setUint32(18, 22, true);

  const bih = 22;
  view.setUint32(bih + 0, 40, true);
  view.setInt32(bih + 4, width, true);
  view.setInt32(bih + 8, height * 2, true);
  view.setUint16(bih + 12, 1, true);
  view.setUint16(bih + 14, 32, true);
  view.setUint32(bih + 16, 0, true);
  view.setUint32(bih + 20, xorBytes + andBytes, true);

  const pxBase = 62;
  const setPixel = (x, yTopDown, r, g, b, a) => {
    if (x < 0 || x >= width || yTopDown < 0 || yTopDown >= height) return;
    const yBottomUp = height - 1 - yTopDown;
    const idx = pxBase + (yBottomUp * width + x) * 4;
    u8[idx + 0] = b;
    u8[idx + 1] = g;
    u8[idx + 2] = r;
    u8[idx + 3] = a;
  };

  const fillRect = (x0, y0, x1, y1, r, g, b, a = 255) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  };

  fillRect(2, 6, 30, 26, 56, 189, 248);
  fillRect(4, 8, 28, 24, 15, 23, 42);

  fillRect(6, 10, 9, 13, 56, 189, 248);
  fillRect(11, 10, 14, 13, 16, 185, 129);
  fillRect(16, 10, 19, 13, 226, 232, 240);
  fillRect(21, 10, 26, 13, 226, 232, 240);

  fillRect(6, 15, 10, 18, 226, 232, 240);
  fillRect(12, 15, 15, 18, 16, 185, 129);
  fillRect(17, 15, 20, 18, 56, 189, 248);
  fillRect(22, 15, 26, 18, 226, 232, 240);

  fillRect(6, 20, 10, 22, 148, 163, 184);
  fillRect(11, 20, 21, 22, 56, 189, 248);
  fillRect(22, 20, 26, 22, 148, 163, 184);

  return u8;
}

const rootDir = process.cwd();
const mainCppPath = path.join(rootDir, 'main.cpp');
const outTsPath = path.join(rootDir, 'src', 'prebuiltExeBase64.ts');

fs.writeFileSync('/tmp/app_keyboard.ico', buildKeyboardIcoBytes());
fs.writeFileSync('/tmp/app_keyboard.rc', '1 ICON "/tmp/app_keyboard.ico"\n');

execSync('x86_64-w64-mingw32-windres /tmp/app_keyboard.rc -O coff -o /tmp/app_keyboard.res', {
  stdio: 'inherit',
});

execSync(
  `x86_64-w64-mingw32-g++ -O3 -flto -s -mwindows -static -DUNICODE -D_UNICODE "${mainCppPath}" /tmp/app_keyboard.res -o /tmp/MKS-test.exe -luser32 -lgdi32 -lcomctl32 -lcomdlg32 -lwinmm -ldwmapi -ladvapi32`,
  { stdio: 'inherit' }
);

const exeBytes = fs.readFileSync('/tmp/MKS-test.exe');
const b64 = exeBytes.toString('base64');

const tsContent = `// Auto-generated real 64-bit native Windows PE32+ executable compiled from main.cpp via x86_64-w64-mingw32-g++
export const PREBUILT_NATIVE_EXE_B64 = "${b64}";
`;

fs.writeFileSync(outTsPath, tsContent);
console.log('Successfully compiled native MKS-test.exe (' + exeBytes.length + ' bytes) and wrote ' + outTsPath);
