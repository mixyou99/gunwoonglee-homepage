#!/bin/bash
cd "$(dirname "$0")"

# Homebrew node가 PATH에 없을 수 있으니 보강 (Finder 더블클릭 대비)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

URL="http://localhost:3000/admin.html"

echo "=== GW Lab Admin Server ==="

# node 설치 확인
if ! command -v node >/dev/null 2>&1; then
  echo "❌ node를 찾을 수 없습니다. Node.js를 설치한 뒤 다시 실행하세요: https://nodejs.org"
  echo "창을 닫으려면 아무 키나 누르세요."
  read -n 1
  exit 1
fi

# 이미 3000 포트에서 서버가 돌고 있으면 브라우저만 열기
if curl -s -o /dev/null "$URL"; then
  echo "이미 실행 중인 서버를 발견했습니다. 브라우저를 엽니다."
  open "$URL"
  exit 0
fi

echo "Admin Panel: $URL"
echo "Ctrl+C 를 누르면 종료됩니다."
echo ""

# 서버를 백그라운드로 시작
node tools/admin-server.js &
SERVER_PID=$!

# Ctrl+C 시 서버도 함께 종료
trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

# 서버가 준비될 때까지 대기 (최대 ~10초)
for i in $(seq 1 50); do
  if curl -s -o /dev/null "$URL"; then
    break
  fi
  sleep 0.2
done

# 준비되면 브라우저 열기
open "$URL"

# 서버 프로세스가 끝날 때까지 대기 (창이 유지되고 Ctrl+C로 종료 가능)
wait $SERVER_PID
