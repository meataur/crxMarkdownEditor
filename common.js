// Load manifest data
var manifestData = chrome.runtime.getManifest();

// CodeMirro editor variable
var editor = null;

// The variable storing current workspaces
var docs = [];

// Tab-related variables
var isNewTabCreated = false;
var prevTabIdx = 0;
var srcTab = null;
var dragImage = null;

// Splitter bar flag
var isPanelResizing = false;

// Create mousedown event
var mousedownEvent = new MouseEvent("mousedown");

document.addEventListener('DOMContentLoaded', function() {
    // Fill extension title into the app title division
    var appTitleDivs = document.getElementsByClassName("appname");
    for (var i = 0; i < appTitleDivs.length; i++)
        appTitleDivs[i].innerHTML = manifestData.name;
    var appVersDivs = document.getElementsByClassName("appvers");
    for (var i = 0; i < appVersDivs.length; i++)
        appVersDivs[i].innerHTML = "v" + manifestData.version;

    // Create markdown editor
    var textarea = document.getElementsByTagName('textarea')[0];
    editor = CodeMirror.fromTextArea(textarea, {
        mode: 'markdown',
        highlightFormatting: true,
        lineNumbers: true,
        lineWrapping: true,
        styleActiveLine: true,
        styleActiveSelected: true,
        indentUnit: 4,
        indentWithTabs: true,
        tabSize: 4,
        extraKeys: {
            "Enter": "newlineAndIndentContinueMarkdownList",
            "Ctrl-F": "findPersistent",
            "Ctrl-H": "replaceAll",
            "Ctrl-G": "jumpToLine",
            "Shift-Ctrl-H": "replace",
            "Shift-Ctrl-G": function() { return false; },
            "Shift-Ctrl-R": function() { return false; },
            "Alt-G": function() { return false; }
        }
    });
    editor.on("change", function(evt) {
        var parsed = parse(editor.getValue());
        var activeTab = getActiveTab();
        if (activeTab) {
            // Active tab index
            var tab = activeTab.tab;
            var i = activeTab.index;

            // Update document title of tab
            var docTitle = tab.getElementsByClassName("doc-title")[0];
            docs[i].texts = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";
            docTitle.innerHTML = docs[i].texts;

            // Update last modified datetime of tab
            var docDatetime = tab.getElementsByClassName("doc-datetime")[0];
            docs[i].last_modified = (parsed.header.date && parsed.header.date.length) ? parsed.header.date : getCurDatetimeString();
            docDatetime.innerHTML = docs[i].last_modified.split(' ')[0];

            // Set mouse over title
            tab.title = docDatetime.innerHTML + "\n" + docTitle.innerHTML;

            // Automatic preview rendering
            preview(parsed);
        }
    });

    // Load settings value
    loadSettings();

    // Load previous works
    loadPrevWorks();

    // Check real-time JSON format
    document.getElementById('attachment-type').addEventListener('keyup', function() {
        try {
            JSON.parse(this.value);
            this.style["background"] = "#fff";
        } catch(e) {
            this.style["background"] = "rgb(238,97,80)";
        }
    });

    // Enable panel splitter dragging
    document.getElementById('gutter').onmousedown = function(evt) {
        isPanelResizing = true;
    };
    document.onmouseup = function(evt) {
        isPanelResizing = false;
    };
    document.onmousemove = function(evt) {
        if (!isPanelResizing) return;
        var container = document.getElementsByTagName("content")[0];
        var panelEditor = document.getElementsByTagName("editor")[0];
        var panelPreview = document.getElementsByTagName("preview")[0];

        var offset = evt.clientX - container.offsetLeft;
        if (offset < 350 || (container.clientWidth - offset) < 350) return;

        var ratio = offset / container.clientWidth * 100;
        panelEditor.style.width = "calc(" + ratio + "% - 0.5px)";
        panelPreview.style.width = "calc(" + (100 - ratio) + "% - 0.5px)";
    }

    // Set buttons event handler
    document.getElementById('newtab').onclick = addNewTab;
    document.getElementById('btn-run-jekyllserve').onclick = runJekyll;
    document.getElementById('btn-info').onclick = openExtensionInfo;

    document.getElementById('btn-tool-new').onclick = initTextarea;
    document.getElementById('btn-tool-open').onclick = openfile;
    document.getElementById('btn-tool-save').onclick = savefile;
    document.getElementById('btn-tool-attachment').onclick = attachments;
    document.getElementById('btn-tool-prettify').onclick = prettify;
    document.getElementById('btn-tool-resettime').onclick = resetPostingTime;
    document.getElementById('btn-tool-settings').onclick = openSettings;

    document.getElementById('localhost-port').onkeypress = numberOnly;
    document.getElementById('btn-download-ruby').onclick = downloadRuby;
    document.getElementById('btn-download-jekyll').onclick = downloadJekyllStandalone;
    document.getElementById('btn-download-installer').onclick = downloadJekyllServeInstaller;
    document.getElementById('btn-download-uninstaller').onclick = downloadJekyllServeUninstaller;

    document.getElementById('select-theme').onchange = selectTheme;
    document.getElementById('select-fontsize').onchange = selectFontsize;

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

    // Keyboard shortcut
    document.onkeydown = function(e) {
        if (e.ctrlKey) {
            switch (e.which) {      // Ctrl + S
            case 83:
                e.preventDefault();
                savefile();
                break;
            }
        } else {
            switch (e.which) {
            case 27:
                e.preventDefault();
                document.getElementsByTagName('overlay')[0].click();
                break;
            }
        }
    };

    // Save the last state of workspace
    window.onbeforeunload = function(e) {
        saveSettings();

        // Save active workspace
        var tabs = document.getElementsByClassName("tab");
        for (var i = 0; i < tabs.length - 1; i++) {
            if (tabs[i].hasAttribute("active")) {
                // Update active document data
                docs[i] = {
                    last_modified: docs[i].last_modified,
                    texts: editor.getValue(),
                    scrollbar: editor.getScrollInfo(),
                    cursor: editor.getCursor(),
                    active: true
                };
                chrome.storage.local.set({ documents: docs });
                break;
            }
        }
    }

    window.onresize = resizeTabWidths;
});

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

function getActiveTab() {
    var tabs = document.getElementsByClassName("tab");
    for (var i = 0; i < tabs.length - 1; i++) {
        if (tabs[i].hasAttribute("active"))
            return { tab: tabs[i], index: i };
    }
    return null;
}

function createTab(docDatetime, docTitle) {
    var divDatetime = document.createElement("div");
    divDatetime.className = "doc-datetime";
    divDatetime.innerHTML = docDatetime;

    var divTitle = document.createElement("div");
    divTitle.className = "doc-title";
    divTitle.innerHTML = docTitle;

    var li = document.createElement("li");
    li.className = "tab";
    li.style.display = "none";
    li.title = docDatetime + "\n" + docTitle;
    li.appendChild(divDatetime);
    li.appendChild(divTitle);
    li.setAttribute("draggable", "true");
    li.addEventListener("dragstart", function(e) {
        e.dataTransfer.effectAllowed = "move";
        srcTab = e.target;

        // Prepare dragging image by element copy
        dragImage = srcTab.cloneNode(true);
        dragImage.style.display = "none";
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 5, 5);
    });
    li.addEventListener("dragover", function(e) {
        // Change mouse cursor on drag
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Select list item
        var dstTab = e.target;
        while (dstTab.tagName.toLowerCase() != "li")
            dstTab = dstTab.parentNode;

        // Swap two list-items
        var srcIdx = Array.prototype.indexOf.call(dstTab.parentNode.children, srcTab);
        var dstIdx = Array.prototype.indexOf.call(dstTab.parentNode.children, dstTab);
        if (dstIdx < srcIdx) {
            dstTab.parentNode.insertBefore(srcTab, dstTab);
            docs[srcIdx] = docs.splice(dstIdx, 1, docs[srcIdx])[0];
        } else if (srcIdx < dstIdx) {
            dstTab.parentNode.insertBefore(srcTab, dstTab.nextSibling);
            docs[srcIdx] = docs.splice(dstIdx, 1, docs[srcIdx])[0];
        }
    });
    li.addEventListener("dragend", function(e) {
        dragImage.parentNode.removeChild(dragImage);
        srcTab = null;
    });
    li.addEventListener("mousedown", function(e) {
        if (this.hasAttribute("active"))
            return;

        // Save editing environment if there exists currently active tab
        var tabs = document.getElementsByClassName("tab");
        for (var i = 0; i < tabs.length - 1; i++) {
            if (tabs[i].hasAttribute("active")) {
                docs[i].texts = editor.getValue();
                docs[i].scrollbar = editor.getScrollInfo();
                docs[i].cursor = editor.getCursor();
                docs[i].active = false;
                prevTabIdx = i;
                
                // Remove active attribute
                tabs[i].removeAttribute("active");

                // Remove tab-close button
                tabs[i].removeChild(tabs[i].getElementsByClassName("tab-close")[0]);
                break;
            }
        }

        // Load selected document texts
        this.setAttribute("active", "");
        for (var i = 0; i < tabs.length - 1; i++) {
            if (tabs[i].hasAttribute("active")) {
                // Load editing environment
                editor.setValue(docs[i].texts);
                editor.scrollTo(docs[i].scrollbar.left, docs[i].scrollbar.top);
                editor.focus();
                editor.setCursor(docs[i].cursor.line, docs[i].cursor.ch);

                // Set active
                docs[i].active = true;

                // Activate tab-close button
                var divClose = document.createElement("div");
                divClose.className = "tab-close";
                divClose.innerHTML = "<svg><use xlink:href=\"images/md.svg#icon-tab-close\"></use></svg>";
                divClose.onclick = closeTab;
                tabs[i].appendChild(divClose);
                break;
            }
        }

        // Save current workspace
        chrome.storage.local.set({ documents: docs });

        // Release tab creation flag
        isNewTabCreated = false;
    });

    return li;
}

function loadPrevWorks() {
    // Load previous workspace
    chrome.storage.local.get("documents", function(result) {
        if (result.documents) {
            result.documents.forEach(function(doc) { docs.push(doc) });

            if (docs.length) {
                var ul = document.getElementById("tabs");
                var activeTab = null;
                docs.forEach(function(doc) {
                    // Parse document text data
                    var parsed = parse(doc.texts);
                    var docDatetime = doc.last_modified.split(' ')[0];
                    var docTitle = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";

                    // Create tab
                    var tab = createTab(docDatetime, docTitle);
                    if (doc.active) activeTab = tab;
                    
                    // Add tab
                    ul.insertBefore(tab, ul.children[ul.children.length - 1]);
                });

                // Click active tab
                if (activeTab) activeTab.dispatchEvent(mousedownEvent);
            } else {
                addNewTab();
            }
        } else {
            addNewTab();
        }

        resizeTabWidths();
    });
}

function addNewTab() {
    // Create new tab
    var newtab = createTab(getCurDatetimeString().split(' ')[0], "Untitled Document");

    // Add tab
    var ul = document.getElementById("tabs");
    ul.insertBefore(newtab, ul.children[ul.children.length - 1]);

    // Add empty document to list
    docs.push({
        last_modified: "",
        texts: "",
        scrollbar: { left: 0, top: 0 },
        cursor: { line: 0, ch: 0 },
        active: false
    });

    // Adjust tab widths
    resizeTabWidths();

    // Click newly-created tab
    newtab.dispatchEvent(mousedownEvent);

    // Set default format
    initTextarea();

    // Set tab creation flag
    isNewTabCreated = true;
}

function closeTab() {
    var tabs = document.getElementsByClassName("tab");
    var nTabs = tabs.length - 1;
    if (nTabs == 1) {
        initTextarea();
        return;
    }

    var activeTab = getActiveTab();
    if (activeTab) {
        // Remove from document list
        docs.splice(activeTab.index, 1);

        // Remove from tabs
        document.getElementById("tabs").removeChild(activeTab.tab);

        // Move to another tab
        if (activeTab.index === nTabs - 1) {
            if (isNewTabCreated) {
                tabs[prevTabIdx].dispatchEvent(mousedownEvent);
                isNewTabCreated = false;
            } else {
                tabs[activeTab.index - 1].dispatchEvent(mousedownEvent);
            }
        } else {
            tabs[activeTab.index].dispatchEvent(mousedownEvent);
        }

        // Save current workspace
        chrome.storage.local.set({ "documents": docs });
    }

    resizeTabWidths();
}

function resizeTabWidths() {
    var bodyWidth = parseInt(window.getComputedStyle(document.body).width);
    var menuWidth = 0;
    Array.from(document.getElementsByClassName("menuitem")).forEach(function(menuItem) {
        menuWidth += parseInt(window.getComputedStyle(menuItem).width);
    });

    var tabs = document.getElementsByClassName("tab");
    var addTabBtnWidth = parseInt(window.getComputedStyle(document.getElementById("newtab")).width);
    var newWidth = (bodyWidth - menuWidth - addTabBtnWidth - 100) / (tabs.length - 1);
    if (newWidth > 180) newWidth = 180;
    Array.from(tabs).forEach(function(tab) {
        if (tab.id !== "newtab") {
            tab.style.width = newWidth + "px";
            tab.style.display = "block";
        }
    });
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

function downloadRuby() {
    chrome.tabs.create({ url: "https://rubyinstaller.org/downloads/" });
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

function initTextarea() {
    if (editor) {
        // Make document template
        var template = "---\n\n";
        template += "layout: post\n";
        template += "title: \n";
        template += "date: " + getCurDatetimeString() + "\n";
        template += "category: \n";
        template += "tags: \n\n";
        template += "---\n\n";

        editor.setValue(template);
        editor.focus();
        editor.setCursor(editor.lineCount(), 0);

        // Automatic preview rendering
        preview(parse(editor.getValue()));
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

var Working = Object.freeze({ "READY": {}, "HEADER": {}, "BODY": {} });

function parse(data) {
    var parsed = {}
    parsed["header"] = {};
    parsed["body"] = {};
    parsed.body["hierarchy"] = "";
    parsed.body["texts"] = "";

    var prevLine = "";
    var curState = Working.READY;

    data = data.replace(/\r/gi, "");
    var lines = data.split("\n");
    for (var i in lines) {
        // Current line texts
        var curLine = lines[i];

        // Work with current line
        if (curState == Working.READY) {
            curLine = curLine.trim();
            if (!curLine.length)
                continue;

            if (curLine.startsWith("---")) {        // At the beginning of post header
                curState = Working.HEADER;
            }
        } else if (curState == Working.HEADER) {
            curLine = curLine.trim();
            if (!curLine.length)
                continue;

            if (curLine.startsWith("---")) {        // At the end of post header
                curState = Working.BODY;
            } else {
                // Save key-value pair of post header
                var key = curLine.split(":")[0].trim();
                var value = curLine.split(":").slice(1).join(":").trim().replace(/ +/g, ' ');
                if (key.length)
                    parsed.header[key] = value;
            }
        } else if (curState == Working.BODY) {
            // Remove succeeding blank lines
            curLine = curLine.trimEnd();
            if (!curLine.length && !prevLine.length)
                continue;

            if (curLine.startsWith("#")) {
                var heading = curLine.replace(/^#+/g, '').trim();
                if (heading.length) {
                    var level = (curLine.match(/#/g) || []).length;
                    // TODO: make headings hierarchy
                }
                parsed.body["texts"] += curLine + "\n\n";
                prevLine = "";
            } else {
                parsed.body["texts"] += curLine + "\n";
                prevLine = curLine;
            }
        }
    }

    // Remove succeeding newlines
    parsed.body["texts"] = parsed.body["texts"].replace(/\n+$/g, '\n');

    return parsed;
}

function getPrettified(data) {
    // Parse data
    var parsed = parse(data);
    var prettified = "---\n\n";

    // Write header
    for (var key in parsed.header)
        prettified += key + ": " + parsed.header[key] + "\n";

    // Write body
    prettified += "\n---\n\n" + parsed.body.texts;

    return prettified;
}

function prettify() {
    if (editor) {
        var data = editor.getValue();
        editor.setValue(getPrettified(data));
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
                editor.setValue(evt.target.result);
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

function preview(parsed) {
    if (editor) {
        var data = "";
        if (parsed.header.title && parsed.header.title.length)
            data += "# " + parsed.header.title + "\n\n";
        if (parsed.body.texts.length)
            data += parsed.body.texts;
        
        // Show preview panel
        var preview = document.getElementById("preview");
        // ifrm.innerHTML += "<meta charset='utf-8'>";
        // ifrm.innerHTML += "<meta http-equiv='X-UA-Compatible' content='IE=edge'>";
        // ifrm.innerHTML += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
        // ifrm.innerHTML += "<link rel='stylesheet' href='preview/preview.css'>";
        // ifrm.innerHTML += "<script type='text/javascript' src='preview/jquery/3.3.1/jquery.min.js'></script>";
        // ifrm.innerHTML += "<link rel='stylesheet' href='preview/font-awesome/4.7.0/css/font-awesome.min.css'>";
        // ifrm.innerHTML += "<script type='text/x-mathjax-config' src='preview/preview.js'></script>";
        // ifrm.innerHTML += "<script type='text/javascript' async src='preview/mathjax/2.7.4/MathJax.js'></script>";
        preview.innerHTML = marked(data);
    }
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
            messageBox("Unable to save as file.\nDocument title is empty.");
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
    }
}
