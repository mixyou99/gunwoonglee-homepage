#!/bin/bash
cd "$(dirname "$0")"
echo "=== GW Lab Admin Server ==="
echo "Admin Panel: http://localhost:3000/admin.html"
echo "Ctrl+C to stop"
echo ""
open "http://localhost:3000/admin.html"
node tools/admin-server.js
