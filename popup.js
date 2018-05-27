// Connect to background.js
var port = chrome.extension.connect({name: "popup"});
var manifestData = chrome.runtime.getManifest();
var editor = null;
var postHeaderKeys = ["layout", "title", "date", "category", "tags"];

// Do something after all contents of document loaded
document.addEventListener('DOMContentLoaded', function() {
    // Fill extension title into the app title division
    var appTitleDivs = document.getElementsByClassName("apptitle");
    for (var i = 0; i < appTitleDivs.length; i++)
        appTitleDivs[i].innerHTML = manifestData.name + " v" + manifestData.version;

    // Create markdown editor
    var textarea = document.getElementsByTagName('textarea')[0];
    editor = CodeMirror.fromTextArea(textarea, {
        mode: 'markdown',
        highlightFormatting: true,
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 4,
        indentWithTabs: true,
        tabSize: 4,
        extraKeys: {
            "Enter": "newlineAndIndentContinueMarkdownList"
        }
    });

    // // Editting by drag-and-drop
    // textarea.addEventListener("dragover", function(evt) {
    //     evt.stopPropagation();
    //     evt.preventDefault();
    //     evt.dataTransfer.dropEffect = 'copy';
    // }, false);
    // textarea.addEventListener("drop", function(evt) {
    //     evt.stopPropagation();
    //     evt.preventDefault();

    //     messageBox("drop!");

    //     for (var i = 0; i < evt.dataTransfer.files.length; i++) {
    //         var f = evt.dataTransfer.files[i];
    //         console.log(f.name, f.type, f.size);
    //     }

    //     var file = evt.dataTransfer.files[0];
    //     var reader = new FileReader();
    //     reader.onload = function(e) {
    //         editor.setValue(e.target.result);
    //         editor.focus();
    //         editor.setCursor(editor.lineCount(), 0);
    //     };
    //     reader.readAsText(file, "UTF-8");
    // }, false);

    // Load settings value
    loadSettings();

    // Check real-time JSON format
    document.getElementById('attachment-type').addEventListener('keyup', function() {
        try {
            JSON.parse(this.value);
            this.style["background-color"] = "#fff";
        } catch(e) {
            this.style["background-color"] = "rgb(238,97,80)";
        }
    });

    // Load previous work
    chrome.storage.local.get('textdata', function(result) {
        if (result.textdata) {
            editor.setValue(getFormattedTexts(result.textdata));
        } else {
            resetEditor();
        }
    });

    // Set scrollbar position
    chrome.storage.local.get('scrollbar', function(result) {
        if (result.scrollbar)
            editor.scrollTo(result.scrollbar.left, result.scrollbar.top);
    });

    // Set cursor position
    chrome.storage.local.get('cursor', function(result) {
        if (result.cursor) {
            editor.focus();
            editor.setCursor(result.cursor.line, result.cursor.ch);
        } else {
            editor.focus();
            editor.setCursor(0, 0);
        }
    });

    // Set button handler
    document.getElementById('btn-tool-new').onclick = resetEditor;
    document.getElementById('btn-tool-open').onclick = openfile;
    document.getElementById('btn-tool-attachment').onclick = attachments;
    document.getElementById('btn-tool-formatting').onclick = formatting;
    document.getElementById('btn-tool-resettime').onclick = resetPostingTime;

    document.getElementById('btn-tool-settings').onclick = openSettings;
    document.getElementById('btn-tool-info').onclick = openExtensionInfo;

    document.getElementById('localhost-port').onkeypress = numberOnly;
    document.getElementById('btn-download-jekyll').onclick = downloadJekyllStandalone;
    document.getElementById('btn-download-installer').onclick = downloadJekyllServeInstaller;
    document.getElementById('btn-download-uninstaller').onclick = downloadJekyllServeUninstaller;

    document.getElementById('select-theme').onchange = selectTheme;
    document.getElementById('select-fontsize').onchange = selectFontsize;
    
    document.getElementById('btn-run-jekyllserve').onclick = runJekyll;
    document.getElementById('btn-saveasfile').onclick = savefile;

    // Set overlay handler
    window.onclick = function(e) {
        if (e.target == document.getElementsByTagName('overlay')[0]) {
            saveSettings();
            document.getElementsByTagName('overlay')[0].style.display = "none";
            document.getElementsByTagName("messagebox")[0].style.display = "none";
            document.getElementsByTagName("settings")[0].style.display = "none";
            document.getElementsByTagName("info")[0].style.display = "none";
        }
    }
});

function loadSettings() {
    chrome.storage.local.get('working_dirpath', function(result) {
        if (result.working_dirpath) {
            document.getElementById("working-dirpath").value = result.working_dirpath;
        }
    });
    chrome.storage.local.get('localhost_port', function(result) {
        if (result.localhost_port) {
            document.getElementById("localhost-port").value = result.localhost_port;
        } else {
            document.getElementById("localhost-port").value = 4000;
        }
    });
    chrome.storage.local.get('theme', function(result) {
        if (result.theme) {
            document.getElementById("select-theme").value = result.theme;
            selectTheme();
        }
    });
    chrome.storage.local.get('fontsize', function(result) {
        if (result.fontsize) {
            document.getElementById("select-fontsize").value = result.fontsize;
            selectFontsize();
        } else {
            document.getElementById("select-fontsize").value = "14";
            selectFontsize();
        }
    });
    chrome.storage.local.get('attachment_location', function(result) {
        if (result.attachment_location) {
            document.getElementById('attachment-location').value = result.attachment_location;
        } else {
            document.getElementById('attachment-location').value = "{{ site.baseurl }}/assets";
        }
    });
    chrome.storage.local.get('attachment_type', function(result) {
        if (result.attachment_type) {
            document.getElementById('attachment-type').value = result.attachment_type;
            document.getElementById('attachment-type').style["background-color"] = "#fff";
        } else {
            document.getElementById('attachment-type').value = '{"img":["png","jpg","jpeg","gif","bmp"],"pdf":["pdf"],"doc":["doc","docx","ppt","pptx","xls","xlsx","hwp","txt","html","htm"]}';
            document.getElementById('attachment-type').style["background-color"] = "#fff";
        }
    });
    chrome.storage.local.get('hashing', function(result) {
        if (result.hashing) {
            var hashing = document.querySelector('input[value="' + result.hashing + '"]')
            hashing.checked = true;
        } else {
            var hashing = document.querySelector('input[value="sha256"]')
            hashing.checked = true;
        }
    });
}

function saveSettings() {
    var themeselector = document.getElementById("select-theme");
    var fontsizeselector = document.getElementById("select-fontsize");
    
    chrome.storage.local.set({
        'working_dirpath': document.getElementById("working-dirpath").value.replace(/\\+$/, ''),
        'localhost_port': document.getElementById("localhost-port").value,
        'theme': themeselector.options[themeselector.selectedIndex].textContent,
        'fontsize': fontsizeselector.options[fontsizeselector.selectedIndex].textContent,
        'attachment_location': document.getElementById('attachment-location').value.replace(/\/+$/, ''),
        'hashing': document.querySelector('input[name="hashing"]:checked').value
    });

    try {
        // JSON parsing test
        JSON.parse(document.getElementById('attachment-type').value);

        chrome.storage.local.set({
            'attachment_type': document.getElementById('attachment-type').value.split(' ').join('')
        });

        return true;
    } catch(e) {
        return false;
    }
}

function messageBox(text) {
    var info = document.getElementsByTagName("info")[0];
    info.style.display = "none";
    var settings = document.getElementsByTagName('settings')[0];
    settings.style.display = 'none';

    var overlay = document.getElementsByTagName("overlay")[0];
    overlay.style.display = "block";
    var messageBox = document.getElementsByTagName("messagebox")[0];
    messageBox.innerHTML = text.replace(/\n/g, '<br />');;
    messageBox.style.display = "block";
}

function openExtensionInfo() {
    var overlay = document.getElementsByTagName("overlay")[0];
    overlay.style.display = "block";
    var info = document.getElementsByTagName("info")[0];
    info.style.display = "block";
}

function openSettings() {
    // Load setting values
    loadSettings();

    // Close settings
    var overlay = document.getElementsByTagName("overlay")[0];
    overlay.style.display = "block";
    var settings = document.getElementsByTagName('settings')[0];
    settings.style.display = 'block';
}

function numberOnly(e) {
    var evt = e || window.event;
    var key = evt.keyCode || evt.which;
    key = String.fromCharCode(key);
    var regex = /[0-9]|\./;
    if (!regex.test(key)) {
        evt.returnValue = false;
        if (evt.preventDefault)
            evt.preventDefault();
    }
}

function downloadJekyllStandalone() {
    chrome.downloads.download({
        url: "https://github.com/ChangUk/jekyll-standalone/archive/master.zip",
        filename: "jekyll-standalone.zip",
        conflictAction: "overwrite"
    });
}

function downloadJekyllServeInstaller() {
    var workingDirectory = document.getElementById("working-dirpath").value;
    if (!workingDirectory) {
        messageBox("Invalid working directory path!");
        return;
    }

    var localhostPort = document.getElementById("localhost-port").value;
    if (!localhostPort) {
        messageBox("Invalid localhost port!");
        return;
    }

    var filedata = `@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

SET JEKYLLSERVE_PORT=` + localhostPort + `
SET JEKYLLSERVE_NAME=jekyllserve%JEKYLLSERVE_PORT%
SET JEKYLLSERVE_PATH=%APPDATA%\\%JEKYLLSERVE_NAME%
SET JEKYLL_PATH=` + workingDirectory + `
SET ALLOWED_ORIGIN=chrome-extension://` + chrome.runtime.id + `/

CALL :ISADMIN

IF %ERRORLEVEL% == 0 (
    REG ADD "HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\%JEKYLLSERVE_NAME%" /ve /t REG_SZ /d "%JEKYLLSERVE_PATH%\\manifest.json" /f
    IF NOT EXIST %JEKYLLSERVE_PATH% mkdir %JEKYLLSERVE_PATH%
    (
        ECHO {
        ECHO "name": "%JEKYLLSERVE_NAME%",
        ECHO "description": "Run Jekyll local server with port %JEKYLLSERVE_PORT%",
        ECHO "path": "jekyllserve.bat",
        ECHO "type": "stdio",
        ECHO "allowed_origins": ["%ALLOWED_ORIGIN%"]
        ECHO }
    ) > %JEKYLLSERVE_PATH%\\manifest.json
    (
        ECHO @ECHO OFF
        ECHO CD %JEKYLL_PATH%
        ECHO START jekyll serve -P %JEKYLLSERVE_PORT%
    ) > %JEKYLLSERVE_PATH%\\jekyllserve.bat

    ECHO MSGBOX "Install Complete." > %TEMP%\\TEMPMSGBOX.vbs
    CALL %TEMP%\\TEMPMSGBOX.vbs
    DEL %TEMP%\\TEMPMSGBOX.vbs /f /q
) ELSE (
    ECHO Set UAC = CreateObject^("Shell.Application"^) > "%TEMP%\\GETADMIN.vbs"
    ECHO UAC.ShellExecute "cmd.exe", "/c %~s0 %~1", "", "runas", 1 >> "%TEMP%\\GETADMIN.vbs"

    "%TEMP%\\GETADMIN.vbs"
    DEL "%TEMP%\\GETADMIN.vbs"
)
EXIT /b

:ISADMIN
    FSUTIL dirty QUERY %SYSTEMDRIVE% > NUL
    EXIT /b
`;

    var a = document.createElement('a');
    a.href = 'data:application/x-bat,' + encodeURI(filedata);
    a.download = "install_jekyllserve.bat";
    a.click();
}

function downloadJekyllServeUninstaller() {
    var localhostPort = document.getElementById("localhost-port").value;
    if (!localhostPort) {
        messageBox("Invalid localhost port!");
        return;
    }

    var filedata = `@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

SET JEKYLLSERVE_PORT=` + localhostPort + `
SET JEKYLLSERVE_NAME=jekyllserve%JEKYLLSERVE_PORT%
SET JEKYLLSERVE_PATH=%APPDATA%\\%JEKYLLSERVE_NAME%

CALL :ISADMIN

IF %ERRORLEVEL% == 0 (
    REG DELETE "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\%JEKYLLSERVE_NAME%" /f
    REG DELETE "HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\%JEKYLLSERVE_NAME%" /f
    RD /s /q %JEKYLLSERVE_PATH%

    ECHO MSGBOX "Uninstall Complete." > %TEMP%\\TEMPMSGBOX.vbs
    CALL %TEMP%\\TEMPMSGBOX.vbs
    DEL %TEMP%\\TEMPMSGBOX.vbs /f /q
) ELSE (
    ECHO Set UAC = CreateObject^("Shell.Application"^) > "%TEMP%\\GETADMIN.vbs"
    ECHO UAC.ShellExecute "cmd.exe", "/c %~s0 %~1", "", "runas", 1 >> "%TEMP%\\GETADMIN.vbs"

    "%TEMP%\\GETADMIN.vbs"
    DEL "%TEMP%\\GETADMIN.vbs"
)
EXIT /b

:ISADMIN
    FSUTIL dirty QUERY %SYSTEMDRIVE% > NUL
    EXIT /b
`;

    var a = document.createElement('a');
    a.href = 'data:application/x-bat,' + encodeURI(filedata);
    a.download = "uninstall_jekyllserve.bat";
    a.click();
}

function selectTheme() {
    var selector = document.getElementById("select-theme")
    var theme = selector.options[selector.selectedIndex].textContent;
    editor.setOption("theme", theme);
}

function selectFontsize() {
    var selector = document.getElementById("select-fontsize")
    var fontsize = selector.options[selector.selectedIndex].textContent;
    var editorObj = document.getElementsByClassName('CodeMirror')[0];
    editorObj.style["font-size"] = fontsize + "px";
    editor.refresh();
}

function getCurDatetimeString() {
    var now = new Date();
    now.setTime(now.getTime()-(now.getTimezoneOffset() * 60 * 1000));
    var strDatetime = now.getUTCFullYear() + "-" + ("0" + (now.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + now.getUTCDate()).slice(-2);
    strDatetime += " " + ("0" + now.getUTCHours()).slice(-2) + ":" + ("0" + now.getUTCMinutes()).slice(-2) + ":" + ("0" + now.getUTCSeconds()).slice(-2);
    return strDatetime;
}

function resetEditor() {
    chrome.storage.local.remove(['textdata', 'scrollbar', 'cursor']);

    if (editor) {
        // Make document template
        var template = "---\n";
        template += "layout: post\n";
        template += "title: \n";
        template += "date: " + getCurDatetimeString() + "\n";
        template += "category: \n";
        template += "tags: \n\n";
        template += "---\n\n";

        editor.setValue(template);
        editor.focus();
        editor.setCursor(editor.lineCount(), 0);
    }
}

function attachments() {
    var input = document.createElement("input");
    input.type = "file";
    input.name = "files";
    input.multiple = "multiple";
    input.addEventListener("change", function(e) {
        var cursor = editor.getCursor();
        var files = e.target.files;

        for (var i = 0, f; f = files[i]; i++) {
            var fext = f.name.toLowerCase().split(".").pop();
            if (fext == "md" || fext == "markdown") {
                continue;
            }

            var reader = new FileReader();
            reader.onload = (function(file) {
                return function(evt) {
                    var fname = file.name;
                    var fext = fname.toLowerCase().split(".").pop();
                    var storage = document.getElementById('attachment-location').value.replace(/\/+$/, '');
                    var type = document.getElementById('attachment-type').value;
                    var hashing = document.querySelector('input[name="hashing"]:checked').value;

                    // Set sub-directory path
                    var jsonObj = JSON.parse(type);
                    var subdir = "";
                    for (var k in jsonObj) {
                        if (jsonObj[k].indexOf(fext) >= 0) {
                        subdir = k + "/";
                        break;
                        }
                    }

                    // Get file hashcode
                    if (hashing != "none") {
                        var ui8a = new Uint8Array(evt.target.result);
                        var tmp = [];
                        for (var i = 0; i < ui8a.length; i += 4)
                            tmp.push(ui8a[i] << 24 | ui8a[i + 1] << 16 | ui8a[i + 2] << 8 | ui8a[i + 3]);
                        var wordArray = CryptoJS.lib.WordArray.create(tmp, ui8a.length);
                        if (hashing == "md5")
                            fname = CryptoJS.MD5(wordArray) + "." + fext;
                        else if (hashing == "sha1")
                            fname = CryptoJS.SHA1(wordArray) + "." + fext;
                        else if (hashing == "sha224")
                            fname = CryptoJS.SHA224(wordArray) + "." + fext;
                        else if (hashing == "sha256")
                            fname = CryptoJS.SHA256(wordArray) + "." + fext;
                        else if (hashing == "sha512")
                            fname = CryptoJS.SHA512(wordArray) + "." + fext;
                    }

                    // Insert text
                    var inputtext = (file.type.startsWith("image")?"!":"")+"["+file.name+"]("+storage+"/"+subdir+fname+")\n";
                    editor.replaceRange(inputtext, { line: cursor.line, ch: cursor.ch }, { line: cursor.line, ch: cursor.ch });
                    editor.setCursor({ line: cursor.line + 1, ch: 0 });
                };
            })(f);
            reader.readAsArrayBuffer(files[i]);
        }
    });

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        input.dispatchEvent(event);
    } else {
        input.click();
    }
}

function getFormattedTexts(data) {
    var formatted = "";
    var prevLine = "";
    var isPostHeader = false;
    var isPostBody = false;
    var expectNewline = false;

    data = data.replace(/\r/gi, "");
    var lines = data.split("\n");
    for (var i in lines) {
        if (expectNewline) {
            formatted += "\n";
            prevLine = "";
            expectNewline = false;
            if (lines[i].length == 0)
                continue;
        }

        // At the beginning or end of post header
        if (lines[i] == "---" && isPostBody == false) {
            isPostHeader = !isPostHeader;

            // End of post header
            if (isPostHeader == false) {
                if (prevLine.length) {
                    formatted += "\n";
                    prevLine = "";
                }
                expectNewline = true;
                isPostBody = true;
            }

            formatted += lines[i] + "\n";
            prevLine = lines[i];
            continue;
        }

        var curLine = lines[i];
        if (isPostHeader) {
            var key = curLine.split(":")[0].trim();

            // Remove invalid header items
            if (postHeaderKeys.indexOf(key) < 0)
                continue;
        } else if (isPostBody) {
            // Remove succeeding blank lines
            if (curLine.length == 0 && prevLine.length == 0)
                continue;
        }

        // Append modification
        formatted += curLine;
        prevLine = curLine;
        if (i < lines.length - 1)
            formatted += "\n";
    }

    return formatted;
}

function formatting() {
    if (editor) {
        var data = editor.getValue();
        editor.setValue(getFormattedTexts(data));
    }
}

function resetPostingTime() {
    var isPostHeader = false;
    if (editor) {
        var data = editor.getValue();
        data = data.replace(/\r/gi, "");
        var lines = data.split("\n");

        for (var i in lines) {
            // At the beginning or end of post header
            if (lines[i] == "---")
                isPostHeader = !isPostHeader;
    
            var curLine = lines[i];
            if (isPostHeader) {
                var key = curLine.split(":")[0].trim();
                if (key == "date") {
                    curLine = "date: " + getCurDatetimeString();
                    editor.replaceRange(curLine, { line: i, ch: 0 }, { line: i, ch: Infinity });
                    break;
                }
            } else {
                break;
            }
        }
    }
}

function openfile() {
    var input = document.createElement("input");
    input.type = "file";
    input.name = "file";
    input.accept = ".md,.markdown";
    input.addEventListener("change", function(e) {
        var reader = new FileReader();
        reader.onload = function(evt) {
            if (evt.target.readyState == FileReader.DONE) {
                editor.setValue(getFormattedTexts(evt.target.result));
                editor.focus();
                editor.setCursor(0, 0);
            }
        };
        reader.readAsText(e.target.files[0]);
    });
    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        input.dispatchEvent(event);
    } else {
        input.click();
    }
}

function runJekyll() {
    document.getElementById('btn-run-jekyllserve').disabled = true;
    var localhost_port = document.getElementById("localhost-port").value;
    if (!localhost_port) {
        messageBox("Invalid localhost port!");
        document.getElementById('btn-run-jekyllserve').disabled = false;
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function() {
        messageBox("Jekyll is now running on port " + localhost_port + ".");
        document.getElementById('btn-run-jekyllserve').disabled = false;
    });
    xhr.addEventListener("error", function() {
        chrome.runtime.sendNativeMessage("jekyllserve" + localhost_port, { text: "" }, function(response) {
            if (!response) {
                var lastError = chrome.runtime.lastError;
                if (lastError) {
                    if (lastError.message == "Access to the specified native messaging host is forbidden.") {
                        // Do nothing
                        messageBox("Invalid \"allowed_origins\" value in manifest JSON file!\nRe-install JekyllServe.");
                    } else if (lastError.message == "Specified native messaging host not found.") {
                        // Not found host application
                        messageBox("Not found host application!\nInstall JekyllServe to be running on port " + localhost_port + ".");
                    } else if (lastError.message == "Error when communicating with the native messaging host.") {
                        // Jekyll is shut down.
                    } else {
                        // Do nothing
                        messageBox("Unknown error occurred!");
                    }
                }
            }
            document.getElementById('btn-run-jekyllserve').disabled = false;
        });
    });
    xhr.open("GET", "http://localhost:" + localhost_port + "/", true);
    xhr.send();
}

function savefile() {
    if (editor) {
        // Read editor's content
        var data = editor.getValue();

        // Parse document header
        var lines = data.match(/[^\r\n]+/g);
        var reading = false;
        var docHeader = {};
        for (var i = 0; i < lines.length; i++) {
            if (lines[i] == "---" && reading == false) {
                reading = true;
                continue;
            }
            if (reading) {
                if (lines[i] == "---") {
                    reading = false;
                    break;
                }

                var tokens = lines[i].split(":");
                docHeader[tokens[0]] = tokens[1].trim();
            }
        }

        // Get save name from document header
        var filename = "";
        if (docHeader["date"])
            filename += docHeader["date"].split(" ")[0]+"-";
        if (docHeader["title"].length == 0) {
            messageBox("Unable to save file.\nDocument title is empty.");
            return;
        }
        filename += docHeader["title"].toLowerCase().split(" ").join("-")+".md";

        // Create download link element
        chrome.downloads.download({
            url: URL.createObjectURL(new Blob([data], {type: "text/x-markdown"})),
            filename: filename,
            conflictAction: "overwrite",
            saveAs: true
        });

        // var a = document.createElement("a");
        // var url = URL.createObjectURL(new Blob([data], {type: "text/x-markdown"}));
        // a.href = url;
        // a.download = filename;

        // // Download document
        // if (document.createEvent) {
        //     var event = document.createEvent('MouseEvents');
        //     event.initEvent('click', true, true);
        //     a.dispatchEvent(event);
        // } else {
        //     a.click();
        // }

        // setTimeout(function() {
        //     document.body.removeChild(a);
        //     window.URL.revokeObjectURL(url);
        // }, 0);
    }
}
