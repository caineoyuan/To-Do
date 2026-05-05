; Quick-Add To-Do — Global Hotkey (Ctrl+Shift+X)
; Requires AutoHotkey v2
; Opens a small browser popup at your cursor to add a task

#Requires AutoHotkey v2.0

^+x:: {
    MouseGetPos(&mx, &my)
    
    ; Position the window near the cursor
    winX := mx - 180
    winY := my - 30
    
    ; Open a small Chrome window (app mode, no toolbar)
    url := "https://to-do-neo.up.railway.app/quick-add.html"
    Run('chrome.exe --app="' . url . '" --window-size=380,60 --window-position=' . winX . ',' . winY)
}
