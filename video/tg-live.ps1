. "$HOME\hackathons\switch\airlock\video\drive.ps1"
Start-Process "tg://resolve?domain=DextraAgreeBot"
Start-Sleep -Seconds 3
Focus-App Telegram
[W]::SetCursorPos(1590, 450)
$out = "$PWD\video\renders\telegram-live.mp4"
Start-Process ffmpeg -ArgumentList '-y','-loglevel','error','-f','gdigrab','-framerate','15','-draw_mouse','0','-offset_x','622','-offset_y','0','-video_size','978x820','-i','desktop','-t','480','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',"`"$out`"" -WindowStyle Hidden
"recording"
