# Define variables
$port = 3000
$counterFile = ".ngrok_counter.txt"

# Initialize counter file if it doesn't exist
if (-not (Test-Path $counterFile)) {
    "0" | Out-File $counterFile -Encoding ascii
}

# Read and increment counter
$count = [int](Get-Content $counterFile)
$count++
$count | Out-File $counterFile -Encoding ascii

$sessionName = "ultraxrtry$count"
Write-Host "`n=== Starting session: $sessionName ===`n"

$serve = Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/k", "npx serve ."
# Wait for serve to start properly
Start-Sleep -Seconds 3

# Start ngrok process (no wait)
$ngrok = Start-Process -FilePath ".\ngrok.exe" -ArgumentList "http", "$port" -PassThru

# Wait for ngrok to initialize and open API
Start-Sleep -Seconds 6

# Try to get the public URL from ngrok API
try {
    $response = Invoke-RestMethod -Uri http://127.0.0.1:4040/api/tunnels
    if ($response.tunnels.Count -gt 0) {
        $url = $response.tunnels[0].public_url
        Write-Host "`n✔ $sessionName is live at:`n$url"
        # TinyURL API token (replace with your real token)
        $apiToken = "iSI5hOW5KcYjMpo5IkcorhBkSCAZOH25P0uSZAspUUBuvoOxxWfHYCVrLcCy"

        $body = @{
            url    = $url
            domain = "tinyurl.com"
            alias  = $sessionName
        } | ConvertTo-Json

        $headers = @{
            Authorization = "Bearer $apiToken"
            "Content-Type" = "application/json"
        }

        try {
            $response = Invoke-RestMethod -Uri "https://api.tinyurl.com/create" `
                                        -Method POST `
                                        -Headers $headers `
                                        -Body $body

            if ($response.data.tiny_url) {
                Write-Host "`n🔗 TinyURL with alias '$sessionName': $($response.data.tiny_url)"
            } else {
                Write-Host "`n❌ Failed to create TinyURL: $($response.errors)"
            }
        } catch {
            Write-Host "`n❌ Error calling TinyURL API: $_"
        }
    } else {
        Write-Host "`n❌ Ngrok API returned no tunnels. Is ngrok running?"
    }
} catch {
    Write-Host "`n❌ Could not reach ngrok API. Make sure ngrok is running and listening on localhost:4040."
}

# Wait for user to end session
Read-Host "`nPress Enter to stop both serve and ngrok..."

# Stop both processes
Stop-Process -Id $serve.Id -Force
Stop-Process -Id $ngrok.Id -Force

Write-Host "`n🛑 Session $sessionName has been stopped."
