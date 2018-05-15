// Connect to background.js
var port = chrome.extension.connect({name: "popup"});
var editor = null;

// Do something after all contents of document loaded
document.addEventListener('DOMContentLoaded', function() {
    // Create markdown editor
    var textarea = document.getElementsByTagName('textarea')[0];
    editor = CodeMirror.fromTextArea(textarea, {
        mode: 'markdown',
        highlightFormatting: true,
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 4,
        extraKeys: {"Enter": "newlineAndIndentContinueMarkdownList"}
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

    //     alert("drop!");

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
    document.getElementById('rsrc-type').addEventListener('keyup', function() {
        try {
            JSON.parse(this.value);
            this.style["background-color"] = "#fff";
        } catch(e) {
            this.style["background-color"] = "rgb(238,97,80)";
        }
    });

    // Load previous work
    chrome.storage.local.get('textarea', function(result) {
        if (result.textarea) {
            editor.setValue(formatting(result.textarea));
            editor.focus();
            editor.setCursor(editor.lineCount(), 0);
        } else {
            resetEditor();
        }
    });

    // Set button handler
    document.getElementById('svg-info').onclick = openExtensionInfo;
    document.getElementById('select-theme').onchange = selectTheme;
    document.getElementById('select-fontsize').onchange = selectFontsize;
    document.getElementById('btn-settings-open').onclick = openSettings;
    document.getElementById('btn-reset').onclick = resetEditor;
    document.getElementById('btn-open').onclick = openfile;
    document.getElementById('btn-export').onclick = exportfile;
    document.getElementById('btn-settings-save').onclick = saveSettings;

    // Set overlay handler
    window.onclick = function(e) {
        if (e.target == document.getElementsByTagName('overlay')[0]) {
            document.getElementsByTagName('overlay')[0].style.display = "none";
            document.getElementsByTagName("info")[0].style.display = "none";
            document.getElementsByTagName("settings")[0].style.display = "none";
        }
    }
});

function loadSettings() {
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
    chrome.storage.local.get('rsrc_storage', function(result) {
        if (result.rsrc_storage) {
            document.getElementById('rsrc-storage').value = result.rsrc_storage;
        } else {
            document.getElementById('rsrc-storage').value = "{{ site.baseurl }}/assets/";
        }
    });
    chrome.storage.local.get('rsrc_type', function(result) {
        if (result.rsrc_type) {
            document.getElementById('rsrc-type').value = result.rsrc_type;
            document.getElementById('rsrc-type').style["background-color"] = "#fff";
        } else {
            document.getElementById('rsrc-type').value = '{"img":["png","jpg","jpeg","gif","bmp"],"pdf":["pdf"],"doc":["doc","docx","ppt","pptx","xls","xlsx","hwp","txt","html","htm"]}';
            document.getElementById('rsrc-type').style["background-color"] = "#fff";
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

function saveSettings() {
    try {
        // JSON parsing test
        JSON.parse(document.getElementById('rsrc-type').value);

        var themeselector = document.getElementById("select-theme");
        var fontsizeselector = document.getElementById("select-fontsize");
        var storagePath = document.getElementById('rsrc-storage').value;
        if (!storagePath.endsWith('/'))
            storagePath += '/';

        chrome.storage.local.set({
            'theme': themeselector.options[themeselector.selectedIndex].textContent,
            'fontsize': fontsizeselector.options[fontsizeselector.selectedIndex].textContent,
            'rsrc_storage': storagePath,
            'rsrc_type': document.getElementById('rsrc-type').value.split(' ').join(''),
            'hashing': document.querySelector('input[name="hashing"]:checked').value
        });

        document.getElementsByTagName("overlay")[0].style.display = "none";
        document.getElementsByTagName("settings")[0].style.display = "none";
    } catch(e) {
        alert("Invalid JSON format!");
    }
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
    chrome.storage.local.remove(['textarea']);

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

function formatting(texts) {
    var formatted = "";
    var prevLine = "";
    var isPostHeader = false;
    var isPostBody = false;
    var expectNewline = false;

    texts = texts.replace(/\r/gi, "");
    var lines = texts.split("\n");
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
            if (key.length == 0)
                continue;
            if (key == "date")
                curLine = "date: " + getCurDatetimeString();
        }

        // Append modification
        formatted += curLine;
        prevLine = curLine;
        if (i < lines.length - 1)
            formatted += "\n";
    }

    return formatted;
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
                editor.setValue(formatting(evt.target.result));
                editor.focus();
                editor.setCursor(editor.lineCount(), 0);
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

function exportfile() {
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
        var filename = docHeader["date"].split(" ")[0]+"-"+docHeader["title"].toLowerCase().split(" ").join("-")+".md";

        // Create download link element
        var a = document.createElement("a");
        var url = URL.createObjectURL(new Blob([data], {type: "text/x-markdown"}));
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);

        // Download document
        if (document.createEvent) {
            var event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            a.dispatchEvent(event);
        } else {
            a.click();
        }

        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}