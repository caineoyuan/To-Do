; Quick-Add To-Do — Global Hotkey (Ctrl+Shift+X)
; Requires AutoHotkey v2
; Shows a dark-themed popup at cursor to add a task via API

#Requires AutoHotkey v2.0

TraySetIcon(A_ScriptDir . "\favicon.ico")

^+x:: {
    CoordMode("Mouse", "Screen")
    MouseGetPos(&mx, &my)
    
    ; Calculate position, keeping window on-screen
    winW := 350
    winH := 60
    monW := SysGet(78)  ; SM_CXVIRTUALSCREEN
    monH := SysGet(79)  ; SM_CYVIRTUALSCREEN
    monL := SysGet(76)  ; SM_XVIRTUALSCREEN
    monT := SysGet(77)  ; SM_YVIRTUALSCREEN
    
    winX := mx - 180
    winY := my - 25
    
    ; Clamp to screen bounds
    if (winX + winW > monL + monW)
        winX := monL + monW - winW - 10
    if (winX < monL)
        winX := monL + 10
    if (winY + winH > monT + monH)
        winY := monT + monH - winH - 10
    if (winY < monT)
        winY := monT + 10
    
    g := Gui("+AlwaysOnTop -Caption +Border")
    g.BackColor := "2a2a2a"
    g.MarginX := 12
    g.MarginY := 12
    g.SetFont("s11 cffffff", "Segoe UI")

    ; Set taskbar icon (must be done after Show, so defer)
    icoPath := A_ScriptDir . "\favicon.ico"
    
    ed := g.AddEdit("w320 h26 Background1e1e1e cffffff -E0x200", "")
    ed.Opt("+0x1500")  ; EM_SETCUEBANNER style
    DllCall("SendMessage", "Ptr", ed.Hwnd, "UInt", 0x1501, "Int", 1, "Str", "Add a task...")
    
    ; Hidden default button to catch Enter
    defBtn := g.AddButton("Default x-100 y-100 w1 h1", "OK")
    defBtn.OnEvent("Click", doSubmit)
    
    g.OnEvent("Escape", doClose)
    g.OnEvent("Close", doClose)
    
    doClose(*) {
        g.Destroy()
    }
    
    doSubmit(*) {
        title := ed.Value
        if (title = "")
            return
        
        url := "https://to-do-neo.up.railway.app/api/tasks"
        body := '{"title":"' . StrReplace(StrReplace(title, "\", "\\"), '"', '\"') . '"}'
        
        try {
            http := ComObject("WinHttp.WinHttpRequest.5.1")
            http.Open("POST", url, false)
            http.SetRequestHeader("Content-Type", "application/json")
            http.SetRequestHeader("X-API-Key", "c30e37b7-0a39-45db-8808-4ec306e5d9b1")
            http.Send(body)
        }
        
        g.Destroy()
    }
    
    g.Show("x" . winX . " y" . winY)
    
    ; Force window to foreground
    WinActivate(g.Hwnd)
    
    ; Set taskbar icon
    try {
        hIcon := DllCall("LoadImage", "Ptr", 0, "Str", icoPath, "UInt", 1, "Int", 16, "Int", 16, "UInt", 0x10, "Ptr")
        hIconBig := DllCall("LoadImage", "Ptr", 0, "Str", icoPath, "UInt", 1, "Int", 32, "Int", 32, "UInt", 0x10, "Ptr")
        DllCall("SendMessage", "Ptr", g.Hwnd, "UInt", 0x80, "Ptr", 0, "Ptr", hIcon)
        DllCall("SendMessage", "Ptr", g.Hwnd, "UInt", 0x80, "Ptr", 1, "Ptr", hIconBig)
    }
    
    ; Apply rounded corners to window (Windows 11)
    try DllCall("dwmapi\DwmSetWindowAttribute", "Ptr", g.Hwnd, "Int", 33, "Int*", 2, "Int", 4)
    
    ed.Focus()
}
