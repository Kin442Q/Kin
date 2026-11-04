# Наполнение школы данными. Запуск: правый клик по файлу -> "Выполнить с помощью PowerShell",
# либо из терминала:  powershell -ExecutionPolicy Bypass -File server\scripts\seed-school.ps1
# Скрипт сам ничего не удаляет и не меняет — только добавляет недостающее.
# Адрес, логин и пароль вводятся здесь, в консоли (пароль не показывается и никуда не сохраняется).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here 'seed-school.mjs'
$csv = Join-Path (Split-Path -Parent (Split-Path -Parent $here)) 'seed-school-credentials.csv'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Не найден Node.js. Установите его с nodejs.org и запустите снова.' -ForegroundColor Red
  Read-Host 'Нажмите Enter, чтобы закрыть'
  exit 1
}

Write-Host ''
Write-Host 'Наполнение школы данными (только добавление, ничего не удаляется)' -ForegroundColor Cyan
Write-Host ''
$api = (Read-Host 'Адрес сервера (API), например https://сайт/api').Trim()
$login = (Read-Host 'Логин (email админа школы)').Trim()
$secure = Read-Host 'Пароль (при вводе не отображается)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

try {
  $env:SEED_API = $api
  $env:SEED_LOGIN = $login
  $env:SEED_PASSWORD = $password
  $env:SEED_OUT = $csv

  Write-Host ''
  Write-Host '--- Шаг 1. Пробный запуск: смотрим, что уже есть и что будет добавлено ---' -ForegroundColor Cyan
  $env:SEED_DRY_RUN = '1'
  & node $script
  if ($LASTEXITCODE -ne 0) { throw 'Пробный запуск не удался. Проверьте адрес, логин и пароль.' }

  Write-Host ''
  $answer = Read-Host 'Загружать данные в эту систему? Напишите "да", чтобы начать'
  if ($answer.Trim().ToLower() -ne 'да') {
    Write-Host 'Отменено. Ничего не записано.' -ForegroundColor Yellow
    return
  }

  Write-Host ''
  Write-Host '--- Шаг 2. Загрузка. Занимает 20-25 минут, окно не закрывайте ---' -ForegroundColor Cyan
  Remove-Item Env:SEED_DRY_RUN -ErrorAction SilentlyContinue
  & node $script
  if ($LASTEXITCODE -ne 0) { throw 'Загрузка завершилась с ошибкой, см. сообщение выше.' }

  Write-Host ''
  Write-Host 'Готово.' -ForegroundColor Green
  if (Test-Path $csv) { Write-Host "Логины и пароли созданных людей: $csv" }
}
finally {
  Remove-Item Env:SEED_API, Env:SEED_LOGIN, Env:SEED_PASSWORD, Env:SEED_OUT, Env:SEED_DRY_RUN -ErrorAction SilentlyContinue
  $password = $null
  Read-Host 'Нажмите Enter, чтобы закрыть'
}
