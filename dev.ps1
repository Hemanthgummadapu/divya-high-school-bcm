# Free port 3001 then start Next.js dev server
$port = 3001
$found = netstat -ano | findstr ":$port.*LISTENING"
if ($found) {
    $processId = ($found -split '\s+')[-1]
    if ($processId -match '^\d+$') {
        Write-Host "Stopping process on port $port (PID $processId)..."
        taskkill /PID $processId /F 2>$null
        Start-Sleep -Seconds 2
    }
}
Write-Host "Starting dev server at http://localhost:$port"
npm run dev
