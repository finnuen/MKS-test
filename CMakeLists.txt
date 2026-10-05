cmake_minimum_required(VERSION 3.16)
project(HardwareDiagnostics LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(HardwareDiagnostics WIN32 main.cpp)

target_compile_definitions(HardwareDiagnostics PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN)

if(MSVC)
    target_compile_options(HardwareDiagnostics PRIVATE /O2 /MT /GL /EHsc /W3)
    target_link_options(HardwareDiagnostics PRIVATE /LTCG /OPT:REF /OPT:ICF /SUBSYSTEM:WINDOWS)
else()
    target_compile_options(HardwareDiagnostics PRIVATE -O3 -flto -Wall -Wextra)
    target_link_options(HardwareDiagnostics PRIVATE -flto -s -mwindows -static)
endif()

target_link_libraries(HardwareDiagnostics PRIVATE
    user32
    gdi32
    comctl32
    comdlg32
    winmm
    dwmapi
)
