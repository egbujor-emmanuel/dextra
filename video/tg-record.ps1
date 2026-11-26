. "$HOME\hackathons\switch\airlock\video\drive.ps1"
Focus-App Telegram
[W]::SetCursorPos(1100, 450)
$out = "$PWD\video\renders\telegram.mp4"
$rec = Start-Process ffmpeg -ArgumentList '-y','-loglevel','error','-f','gdigrab','-framerate','30','-draw_mouse','0','-offset_x','622','-offset_y','0','-video_size','978x820','-i','desktop','-t','30','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',"`"$out`"" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
for ($i = 0; $i -lt 7; $i++) { Wheel 1100 450 2; Start-Sleep -Milliseconds 1100 }
Start-Sleep -Seconds 2
for ($i = 0; $i -lt 7; $i++) { Wheel 1100 450 -2; Start-Sleep -Milliseconds 1000 }
$rec.WaitForExit()
"done"
