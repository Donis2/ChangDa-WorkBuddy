@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 一键推送到 GitHub
cd /d "%~dp0"

echo ==========================================================
echo   一键推送到 GitHub  ^|  Donis2/ChangDa-WorkBuddy
echo ==========================================================
echo.

where git >nul 2>nul
if errorlevel 1 goto :no_git

rem ---------- 1. 暂存改动 ----------
git add -A
git diff --cached --quiet
if errorlevel 1 goto :has_changes
echo [1/3] 没有需要提交的改动
goto :push

:has_changes
echo [1/3] 检测到以下改动：
echo.
git -c core.quotepath=false status --short
echo.
set "MSG="
set /p "MSG=请输入本次提交说明，直接回车则使用默认说明： "
if not defined MSG set "MSG=更新项目文件"

rem ---------- 2. 提交 ----------
echo.
echo [2/3] 正在提交：!MSG!
git commit -m "!MSG!"
if errorlevel 1 goto :commit_failed

rem ---------- 3. 推送 ----------
:push
echo [3/3] 正在推送到 origin main ...
git push origin main
if errorlevel 1 goto :push_failed

echo.
echo [完成] 已推送，仓库地址：
echo        https://github.com/Donis2/ChangDa-WorkBuddy
echo.
pause
exit /b 0

:no_git
echo [错误] 未检测到 git，请先安装 Git for Windows：
echo        https://git-scm.com/download/win
echo.
pause
exit /b 1

:commit_failed
echo [错误] 提交失败，请查看上方信息后重试。
echo.
pause
exit /b 1

:push_failed
echo [错误] 推送失败，常见原因：
echo        - 网络不通：可先执行 ping github.com 检查
echo        - 凭据失效：重新执行一次 git push，按弹窗登录 GitHub
echo.
pause
exit /b 1
