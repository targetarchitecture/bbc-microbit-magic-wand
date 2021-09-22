
taskkill /f /im chrome.exe 2> nul & ver > nul

set url="http://127.0.0.1:8080"
start chrome %url% --auto-open-devtools-for-tabs

rem start "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "http://127.0.0.1:8080" --auto-open-devtools-for-tabs

http-server "./" -c-1 
