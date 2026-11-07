@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 常大 855 机械设计基础 · 真题刷题平台
cd /d "%~dp0"

echo ==========================================================
echo   常大 855 机械设计基础 · 考研真题刷题平台
echo ==========================================================
echo.

rem ---------- 1. 检查 Node.js ----------
where node >nul 2>nul
if errorlevel 1 goto :no_node
for /f "delims=" %%v in ('node -v') do set "NODEV=%%v"
echo [1/4] Node.js 版本 !NODEV!

rem ---------- 2. 安装依赖 ----------
if exist "node_modules\" goto :deps_ok
echo [2/4] 正在安装依赖，首次较慢，使用国内镜像 ...
call npm install --registry=https://registry.npmmirror.com
if errorlevel 1 goto :install_failed
goto :deps_done
:deps_ok
echo [2/4] 依赖已存在，跳过安装
:deps_done

rem ---------- 3. 构建题库数据 ----------
set "PYEXE="
if exist "C:\Users\HUAWEI\.workbuddy\binaries\python\envs\default\Scripts\python.exe" set "PYEXE=C:\Users\HUAWEI\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
if defined PYEXE goto :have_py
where python >nul 2>nul
if errorlevel 1 goto :no_py
set "PYEXE=python"
:have_py
echo [3/4] 正在构建题库数据 scripts\build_data.py
"!PYEXE!" scripts\build_data.py
if errorlevel 1 echo [警告] 数据构建失败，继续使用已有题库启动
goto :next_step
:no_py
echo [3/4] 未检测到 Python，跳过数据重建，直接使用已有题库
:next_step

rem ---------- 4. 释放 5173 端口并启动 ----------
echo [4/4] 启动开发服务器 ...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo      端口 5173 已被进程 %%p 占用，正在关闭旧服务
    taskkill /F /PID %%p >nul 2>nul
)

call npm run dev
if errorlevel 1 goto :run_failed
goto :done

:no_node
echo [错误] 未检测到 Node.js，请先安装 Node.js 18 或以上版本
echo        https://nodejs.org/
echo.
pause
exit /b 1

:install_failed
echo [错误] 依赖安装失败，请检查网络后重试
echo.
pause
exit /b 1

:run_failed
echo.
echo [错误] 启动失败，请查看上方错误信息
echo.
pause
exit /b 1

:done
endlocal
