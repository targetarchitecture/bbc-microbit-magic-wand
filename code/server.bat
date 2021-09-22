
taskkill /f /im chrome.exe 2> nul & ver > nul

set url="http://127.0.0.1:8080/index.html"
start chrome %url% --auto-open-devtools-for-tabs

http-server "./" -c-1 
