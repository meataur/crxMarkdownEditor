// Load manifest data
var manifestData = chrome.runtime.getManifest();

// CodeMirro editor variable
var editor = null;
var converter = null;

// Vertical panels
var panelEditor = null;
var panelWrapperHelper = null;
var panelViewer = null;
var panelLocalhost = null;
var panelHelp = null;
var splitter = null;
var isPanelResizing = false;

document.addEventListener("DOMContentLoaded", function () {
  // Set tab title
  document.title = manifestData.name;

  // Fill extension title into the app title division
  var appTitleDivs = document.getElementsByClassName("appname");
  for (var i = 0; i < appTitleDivs.length; i++)
    appTitleDivs[i].innerHTML = manifestData.name;
  var appVersDivs = document.getElementsByClassName("appvers");
  for (var i = 0; i < appVersDivs.length; i++)
    appVersDivs[i].innerHTML = "v" + manifestData.version;

  // Create markdown editor
  var textarea = document.getElementById("editor-textarea");
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
      "Shift-Ctrl-G": function () {
        return false;
      },
      "Shift-Ctrl-R": function () {
        return false;
      },
      "Alt-G": function () {
        return false;
      }
    }
  });
  editor.on("change", function (e) {
    var selectedTab = Tab.get();
    if (selectedTab) {
      preview(selectedTab.info.metadata.title, editor.getValue());
    }
  });

  // Create showdown object
  converter = new showdown.Converter({
    disableForced4SpacesIndentedSublists: true,
    tables: true,
    simpleLineBreaks: true,
    requireSpaceBeforeHeadingText: true,
    strikethrough: true,
    tasklists: true,
    ghCompatibleHeaderId: true,
    parseImgDimensions: true
  });

  // Load previous workspaces and setting values
  if (!Settings.loadAll()) {
    messageBox("Unabled to load setting values.");
  }
  loadPrevWorks();

  var header = document.getElementsByTagName("header")[0];
  header.addEventListener("mouseleave", function (e) {
    Tab.resize();
  });
  var headerMenu = header.getElementsByTagName("menu")[0];
  headerMenu.addEventListener("mouseenter", function (e) {
    Tab.resize();
  });

  // Panels and splitter
  panelEditor = document.getElementsByTagName("editor")[0];
  panelWrapperHelper = document.getElementsByTagName("helper")[0];
  panelViewer = document.getElementsByTagName("viewer")[0];
  panelLocalhost = document.getElementsByTagName("localhost")[0];
  panelHelp = document.getElementsByTagName("help")[0];
  splitter = document.getElementsByTagName("splitter")[0];

  // Panel selection
  document.getElementById('menu-viewer').onclick = openPanelViewer;
  document.getElementById('menu-localhost').onclick = openPanelLocalhost;
  document.getElementById('menu-help').onclick = openPanelHelp;
  document.getElementById('menu-viewer').click();

  // Set buttons event handler
  document.getElementById("btn-download-ruby").onclick = getRubyLang;
  document.getElementById("btn-download-jekyll").onclick = getJekyllStandalone;
  document.getElementById("btn-download-jekylllauncher").onclick = getJekyllLauncher;
  document.getElementById("btn-reset-settings").onclick = resetAllSettings;

  // Setting values key-pressing event handlers
  document.getElementById("editor-settings-theme").onchange = selectTheme;
  document.getElementById("editor-settings-fontsize").onchange = selectFontsize;
  document.getElementById("attachment-settings-types").onkeyup = checkJSONFormat;
  document.getElementById("jekyll-settings-port").onkeypress = numberOnly;

  // Set menu event handler of content panels
  Array.from(document.getElementsByClassName("panel-menu")).forEach(function (panelMenu) {
    Array.from(panelMenu.children).forEach(function (panelMenuItem) {
      var dropdown = panelMenuItem.getElementsByClassName("dropdown")[0];
      if (dropdown) {
        // Add caret to panel item
        panelMenuItem.classList.add("has-dropdown");

        // Set dropdown menu item's event handler
        Array.from(dropdown.children).forEach(function (dropdownItem) {
          dropdownItem.addEventListener("mouseover", function (e) {
            this.classList.add("highlight");
            e.stopPropagation();
          });
          dropdownItem.addEventListener("mouseout", function (e) {
            this.classList.remove("highlight");
          });
          dropdownItem.addEventListener("mousedown", function (e) {
            e.stopPropagation();
          });
          dropdownItem.addEventListener("click", function (e) {
            collapseAllDropdowns();
            deselectAllTempPanelMenuItems();
            closeAllDialogs();
          });
        });
      }

      panelMenuItem.addEventListener("mouseover", function (e) {
        this.classList.add("highlight");
      });
      panelMenuItem.addEventListener("mouseout", function (e) {
        this.classList.remove("highlight");
      });
      panelMenuItem.addEventListener("mousedown", function (e) {
        if (e.which !== 1) {
          e.preventDefault();
          return;
        }

        collapseAllDropdowns();
        closeAllDialogs();

        if (this.classList.contains("selected")) {
          // Deselect all panel menu items
          deselectAllTempPanelMenuItems();
        } else {
          // Deselect all panel menu items
          deselectAllTempPanelMenuItems();

          // If a dropdown menu exists
          if (dropdown) {
            // Select current panel menu
            this.classList.add("selected");

            // Show dropdown menu
            dropdown.style.display = "block";

            // Adjust dropdown menu's position
            adjustDropdownPosition(this);
          }
        }

        e.stopPropagation();
      });
    });
  });

  // Helper functions

  document.getElementById("editor-tools-import-local").onclick = IO.Local.open;
  document.getElementById("editor-tools-import-github").onclick = IO.Github.open;
  document.getElementById("editor-tools-import-gdrive").onclick = IO.GDrive.open;
  document.getElementById("editor-tools-save-local").onclick = IO.Local.save;
  document.getElementById("editor-tools-save-github").onclick = IO.Github.save;
  document.getElementById("editor-tools-save-gdrive").onclick = IO.GDrive.save;
  document.getElementById("editor-tools-doc-metadata").onclick = Metadata.openPanel;
  document.getElementById("editor-tools-makenew").onclick = Tab.makeNew;
  document.getElementById("editor-tools-attachment").onclick = attachments;
  document.getElementById("editor-tools-prettify").onclick = prettify;
  document.getElementById("editor-tools-settings").onclick = Settings.openEditorSettingsPanel;

  document.getElementById("viewer-tools-export-html").onclick = IO.Local.saveAsHtml;
  document.getElementById("viewer-tools-export-pdf").onclick = IO.Local.saveAsPdf;
  document.getElementById("viewer-tools-print").onclick = IO.Local.print;
  document.getElementById("viewer-tools-expand").onclick = expandViewer;
  document.getElementById("viewer-tools-settings").onclick = Settings.openViewerSettingsPanel;

  document.getElementById("localhost-tools-jekyll-setup").onclick = setupJekyll;
  document.getElementById("localhost-tools-run-jekyll").onclick = runJekyll;
  document.getElementById("localhost-tools-visit-site").onclick = visitJekyllSite;

  document.getElementById("help-tools-md-tutorial").onclick = openMdTutorial;
  document.getElementById("help-tools-about").onclick = openAboutPage;

  // Prevent event propagation on dialogs
  Array.from(document.getElementsByClassName("dlg")).forEach(function (dialog) {
    dialog.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });
  });

  // Enable panel splitter dragging
  splitter.onmousedown = function (e) {
    isPanelResizing = true;
  };
  splitter.ondblclick = function (e) {
    panelEditor.style.width = "calc(50% - " + (splitter.clientWidth / 2) + "px)";
    panelWrapperHelper.style.width = "calc(50% - " + (splitter.clientWidth / 2) + "px)";
  };
  document.onmousemove = function (e) {
    if (!isPanelResizing) return;

    var wrapper = document.getElementsByTagName("content")[0];
    var offset = e.clientX - wrapper.offsetLeft;
    if (offset < 400 || (wrapper.clientWidth - offset) < 400) return;

    var ratio = offset / wrapper.clientWidth * 100;
    panelEditor.style.width = "calc(" + ratio + "% - " + (splitter.clientWidth / 2) + "px)";
    panelWrapperHelper.style.width = "calc(" + (100 - ratio) + "% - " + (splitter.clientWidth / 2) + "px)";
  };
  document.onmouseup = function (e) {
    // Escape from panel resizing mode
    isPanelResizing = false;
  };
  document.onmousedown = function (e) {
    collapseAllDropdowns();
    deselectAllTempPanelMenuItems();
    closeAllDialogs();
  };

  // Keyboard shortcut
  document.onkeydown = function (e) {
    if (e.ctrlKey) {
      switch (e.which) {
        case 79:  // Ctrl + O
          e.preventDefault();
          IO.Local.open();
          break;
        case 81:  // Ctrl + Q (for testing)
          e.preventDefault();
          messageBox("test");
          break;
        case 83:  // Ctrl + S
          e.preventDefault();
          IO.Local.save();
          break;
      }
    } else {
      switch (e.which) {
        case 27: // Escape key
          e.preventDefault();

          var toggle = document.getElementById("viewer-tools-expand");
          if (toggle.hasAttribute("expanded"))
            toggle.click();

          closeAllDialogs();
          break;
      }
    }
  }

  // Scrollbar synchronization
  var editorScroll = document.getElementsByClassName("CodeMirror-scroll")[0];
  var viewerScroll = document.getElementById("viewer");
  var editorScrollSync = false;
  var viewerScrollSync = false;
  // editorScroll.addEventListener("scroll", function (e) {
  //   if (!editorScrollSync) {
  //     viewerScrollSync = true;
  //     var posRatio = editorScroll.scrollTop / editorScroll.scrollHeight;
  //     viewerScroll.scrollTop = viewerScroll.scrollHeight * posRatio;
  //   }
  //   editorScrollSync = false;
  // });
  // viewerScroll.addEventListener("scroll", function (e) {
  //   if (!viewerScrollSync) {
  //     editorScrollSync = true;
  //     var posRatio = viewerScroll.scrollTop / viewerScroll.scrollHeight;
  //     editorScroll.scrollTop = editorScroll.scrollHeight * posRatio;
  //   }
  //   viewerScrollSync = false;
  // });

  // The 'window.onresize' callback function is called after printing.
  window.onresize = function (e) {
    if (panelEditor.style.display == "none" || splitter.style.display == "none" || panelWrapperHelper.style.display == "none")
      return;

    Tab.resize();

    var wrapper = document.getElementsByTagName("content")[0];
    if (panelEditor.clientWidth <= 400) {
      var ratio = 400 / wrapper.clientWidth * 100;
      panelEditor.style.width = "calc(" + ratio + "% - " + (splitter.clientWidth / 2) + "px)";
      panelWrapperHelper.style.width = "calc(" + (100 - ratio) + "% - " + (splitter.clientWidth / 2) + "px)";
    } else if (panelWrapperHelper.clientWidth <= 400) {
      var ratio = 400 / wrapper.clientWidth * 100;
      panelEditor.style.width = "calc(" + (100 - ratio) + "% - " + (splitter.clientWidth / 2) + "px)";
      panelWrapperHelper.style.width = "calc(" + ratio + "% - " + (splitter.clientWidth / 2) + "px)";
    }
  }

  // Save the last state of workspace
  window.onbeforeunload = function (e) {
    var selectedTab = Tab.get();
    selectedTab.info.metadata = Metadata.getMetadataFromPanel();
    selectedTab.info.texts = editor.getValue();
    selectedTab.info.editor.scrollPos = editor.getScrollInfo();
    selectedTab.info.editor.cursor = editor.getCursor();
    selectedTab.info.viewer.scrollPos = document.getElementById("viewer").scrollTop;
    Tab.set(selectedTab.index, selectedTab.info);
    
    if (Settings.autoSave) {
      Settings.saveAll();
      Tab.save();
    }
  }
});

function messageBox(texts, duration) {
  if (typeof (duration) === "undefined")
    duration = texts.length * 90;
  if (duration > 3000)
    duration = 3000;
  if (duration < 1500)
    duration = 1500;

  var msgboxWrapper = document.getElementById("messagebox-wrapper");
  var outer = document.createElement("div");
  var msgbox = document.createElement("messagebox");
  msgbox.innerHTML = texts.replace(/\n/g, '<br />');
  outer.appendChild(msgbox);
  msgboxWrapper.appendChild(outer);
  setTimeout(function () {
    msgbox.style.opacity = 1;
  }, 100);
  setTimeout(function () {
    msgbox.style.opacity = 0;
    setTimeout(function () {
      msgbox.parentNode.removeChild(msgbox);
    }, 300);
  }, duration);
}



/**
 * Workspaces
 */

function loadPrevWorks() {
  chrome.storage.local.get("documents", function (result) {
    if (result.documents) {
      result.documents.forEach(function (docInfo) {
        var tab = Tab.create(docInfo);
        Tab.add(tab, docInfo);
      });
    }
    if (Tab.count() == 0)
      Tab.addNew();
  });
}



/**
 * Panels
 */

function closeAllHelperPanels() {
  panelViewer.style.display = "none";
  document.getElementById("menu-viewer").style.color = "unset";
  panelLocalhost.style.display = "none";
  document.getElementById("menu-localhost").style.color = "unset";
  panelHelp.style.display = "none";
  document.getElementById("menu-help").style.color = "unset";
}

function closeAllHelperPanelPages() {
  Array.from(panelWrapperHelper.getElementsByClassName("hpage")).forEach(function (hpage) {
    hpage.style.display = "none";
  });
  Array.from(panelWrapperHelper.getElementsByClassName("panel-menu")).forEach(function (panelMenu) {
    Array.from(panelMenu.children).forEach(function (panelMenuItem) {
      panelMenuItem.classList.remove("selected");
    });
  });
}

function openPanelViewer() {
  closeAllHelperPanels();
  panelViewer.style.display = "block";
  document.getElementById("menu-viewer").style.color = "#fff";
}

function openPanelLocalhost() {
  closeAllHelperPanels();
  panelLocalhost.style.display = "block";
  document.getElementById("menu-localhost").style.color = "#fff";
  setupJekyll();
}

function openPanelHelp() {
  closeAllHelperPanels();
  panelHelp.style.display = "block";
  document.getElementById("menu-help").style.color = "#fff";
  openMdTutorial();
}



/**
 * Dropdown menu
 */

function adjustDropdownPosition(el) {
  var dropdown = el.getElementsByClassName("dropdown")[0];
  if (dropdown.style.display === "none")
    return;

  var containerWidth = parseInt(window.getComputedStyle(el.getAncestorByClassName("panel-header")).width);
  var thisLeft = parseInt(el.offsetLeft);
  var dropdownWidth = parseInt(window.getComputedStyle(dropdown).width);

  if (containerWidth - thisLeft > dropdownWidth) {
    dropdown.classList.remove("leftward");
    dropdown.classList.add("rightward");
  } else {
    dropdown.classList.remove("rightward");
    dropdown.classList.add("leftward");
  }
}

function collapseAllDropdowns() {
  Array.from(document.getElementsByClassName("dropdown")).forEach(function (dropdown) {
    dropdown.style.display = "none";
  });
}

function deselectAllPanelMenuItems() {
  Array.from(document.getElementsByClassName("panel-menu")).forEach(function (panelMenu) {
    Array.from(panelMenu.children).forEach(function (panelMenuItem) {
      panelMenuItem.classList.remove("selected");
    });
  });
}

function deselectAllTempPanelMenuItems() {
  Array.from(document.getElementsByClassName("panel-menu")).forEach(function (panelMenu) {
    Array.from(panelMenu.children).forEach(function (panelMenuItem) {
      if (panelMenuItem.classList.contains("has-dropdown"))
        panelMenuItem.classList.remove("selected");
    });
  });
}

function closeAllDialogs() {
  Array.from(document.getElementsByClassName("dlg")).forEach(function (dialog) {
    dialog.style.display = "none";
  });
}



/**
 * Helper functions
 */

function expandViewer() {
  var panelHeaderHeight = 45;

  if (this.hasAttribute("expanded")) {
    this.removeAttribute("expanded");
    this.getElementsByTagName("svg")[0].innerHTML = "<use xlink:href=\"icons.svg#icon-expand\"></use>";
    this.getElementsByTagName("span")[0].innerHTML = "expand screen";
    document.getElementsByTagName("header")[0].removeAttribute("style");
    document.getElementsByTagName("content")[0].removeAttribute("style");
    document.getElementById("viewer").getAncestorByClassName("panel-body").removeAttribute("style");
    panelEditor.removeAttribute("style");
    splitter.removeAttribute("style");
    panelWrapperHelper.removeAttribute("style");
  } else {
    this.setAttribute("expanded", "");
    this.getElementsByTagName("svg")[0].innerHTML = "<use xlink:href=\"icons.svg#icon-converge\"></use>";
    this.getElementsByTagName("span")[0].innerHTML = "return to editor";
    document.getElementsByTagName("header")[0].style.display = "none";
    document.getElementsByTagName("content")[0].style.height = "calc(100vh)";
    document.getElementById("viewer").getAncestorByClassName("panel-body").style.height = "calc(100vh - " + panelHeaderHeight + "px)";
    panelEditor.style.display = "none";
    splitter.style.display = "none";
    panelWrapperHelper.style.width = "100%";
  }
}

function setupJekyll() {
  closeAllHelperPanelPages();
  document.getElementById("hpage-jekyll-setup").style.display = "block";
  document.getElementById("localhost-tools-jekyll-setup").classList.add("selected");
  document.getElementById("localhost-panel-title").innerHTML = "localhost setup";
}

function runJekyll() {
  var port = document.getElementById("jekyll-settings-port").value;
  if (!port) {
    messageBox("Invalid localhost port!");
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    messageBox("Jekyll is now running on port " + port + ".");
  }
  xhr.onerror = function () {
    chrome.runtime.sendNativeMessage("jekyllserve" + port, {
      text: ""
    }, function (response) {
      if (!response) {
        var lastError = chrome.runtime.lastError;
        if (lastError) {
          if (lastError.message == "Access to the specified native messaging host is forbidden.") {
            // Do nothing
            messageBox("Invalid \"allowed_origins\" value in manifest JSON file!\nRe-install Jekyll Launcher.");
          } else if (lastError.message == "Specified native messaging host not found.") {
            // Not found host application
            messageBox("Not found host application!\nInstall Jekyll Launcher to be running on port " + port + ".");
          } else if (lastError.message == "Error when communicating with the native messaging host.") {
            // Jekyll is shut down.
          } else {
            // Do nothing
            messageBox("Unknown error occurred!");
          }
        }
      }
    });
  }
  xhr.open("GET", "http://localhost:" + port + "/", true);
  xhr.send();
}

function visitJekyllSite() {
  var port = document.getElementById("jekyll-settings-port").value;
  if (!port) {
    messageBox("Invalid localhost port!");
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    window.open("http://localhost:" + port);
  }
  xhr.onerror = function () {
    messageBox("The Jekyll site is not responding.\nCheck if Jekyll is running properly.");
  }
  xhr.open("GET", "http://localhost:" + port + "/", true);
  xhr.send();
}

function openMdTutorial() {
  closeAllHelperPanelPages();

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "tutorial.md");
  xhr.onload = function (e) {
    var data = converter.makeHtml(this.response);
    data = data.replaceAll("·", "<ind>·</ind>").replaceAll("↵", "<ind>↵</ind>").replaceAll("⇥", "<ind>⇥</ind>");
    document.getElementById("hpage-md-tutorial").innerHTML = data;
    renderMathInElement(document.getElementById("hpage-md-tutorial"), {
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "\\[", right: "\\]", display: true},
        {left: "$", right: "$", display: false},
        {left: "\\(", right: "\\)", display: false}
      ]
    });
  }
  xhr.send();

  document.getElementById("hpage-md-tutorial").style.display = "block";
  document.getElementById("help-tools-md-tutorial").classList.add("selected");
  document.getElementById("help-panel-title").innerHTML = "markdown tutorial";
}

function openAboutPage() {
  closeAllHelperPanelPages();
  document.getElementById("hpage-about").style.display = "block";
  document.getElementById("help-tools-about").classList.add("selected");
  document.getElementById("help-panel-title").innerHTML = "about";
}



/**
 * Et cetera
 */

function checkJSONFormat() {
  try {
    JSON.parse(this.value);
    this.style["background"] = "#383838";
  } catch (e) {
    this.style["background"] = "rgb(238,97,80)";
  }
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

function getRubyLang() {
  chrome.tabs.create({
    url: "https://rubyinstaller.org/downloads/"
  });
}

function getJekyllStandalone() {
  chrome.downloads.download({
    url: "https://github.com/ChangUk/jekyll-standalone/archive/master.zip",
    filename: "jekyll-standalone.zip",
    conflictAction: "overwrite"
  });
}

function getJekyllLauncher() {
  var workingDirectory = document.getElementById("jekyll-settings-localpath").value;
  if (!workingDirectory) {
    messageBox("Invalid working directory path!");
    return;
  }

  var localhostPort = document.getElementById("jekyll-settings-port").value;
  if (!localhostPort) {
    messageBox("Invalid localhost port!");
    return;
  }

  var installer = `@ECHO OFF
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

  var uninstaller = `@ECHO OFF
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

  var zip = new JSZip();
  zip.file("installer.bat", installer);
  zip.file("uninstaller.bat", uninstaller);
  zip.generateAsync({
    type: "blob"
  }).then(function (zipped) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(zipped);
    a.download = "jekyll_launcher.zip";
    a.click();
  });
}

function resetAllSettings () {
  Tab.resetData();
  Settings.reset();
  Settings.autoSave = false;
  chrome.runtime.reload();
}

function selectTheme() {
  var selector = document.getElementById("editor-settings-theme");
  var theme = selector.options[selector.selectedIndex].textContent;
  editor.setOption("theme", theme);
}

function selectFontsize() {
  var selector = document.getElementById("editor-settings-fontsize");
  var fontsize = selector.options[selector.selectedIndex].textContent;
  var editorObj = document.getElementsByClassName('CodeMirror')[0];
  editorObj.style["font-size"] = fontsize + "px";
  editor.refresh();
}

function attachments() {
  var input = document.createElement("input");
  input.type = "file";
  input.name = "files";
  input.multiple = "multiple";
  input.addEventListener("change", function (e) {
    var cursor = editor.getCursor();
    var files = e.target.files;

    for (var i = 0, f; f = files[i]; i++) {
      var fext = f.name.toLowerCase().split(".").pop();
      if (fext == "md" || fext == "markdown") {
        continue;
      }

      var reader = new FileReader();
      reader.onload = (function (file) {
        return function (evt) {
          var fname = file.name;
          var fext = fname.toLowerCase().split(".").pop();
          var storage = document.getElementById('attachment-settings-location').value.replace(/\/+$/, '');
          var type = document.getElementById('attachment-settings-types').value;
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
          var inputtext = (file.type.startsWith("image") ? "!" : "") + "[" + file.name + "](" + storage + "/" + subdir + fname + ")\n";
          editor.replaceRange(inputtext, {
            line: cursor.line,
            ch: cursor.ch
          }, {
            line: cursor.line,
            ch: cursor.ch
          });
          editor.setCursor({
            line: cursor.line + 1,
            ch: 0
          });
        };
      })(f);
      reader.readAsArrayBuffer(files[i]);
    }
  });

  input.click();
}

function prettify() {
  messageBox("Not support yet...");
}

function preview(docTitle, data) {
  if (editor) {
    var viewer = document.getElementById("viewer");
    if (data.length) {
      // Set site's base url to localhost
      var baseurl = document.getElementById("viewer-settings-baseurl").value;
      data = data.replace(/{{ site.baseurl }}/gi, baseurl);

      // Show preview panel
      var html = converter.makeHtml("# " + docTitle + "\n\n" + data);
      viewer.removeAllChildren();
      viewer.innerHTML = html;
      renderMathInElement(viewer, {
        delimiters: [
          {left: "$$", right: "$$", display: true},
          {left: "\\[", right: "\\]", display: true},
          {left: "$", right: "$", display: false},
          {left: "\\(", right: "\\)", display: false}
        ]
      });
    } else {
      viewer.removeAllChildren();
      var noContent = document.createElement("div");
      noContent.classList.add("no-content");
      noContent.innerHTML = "There is nothing displayed on viewer.";
      viewer.appendChild(noContent);
    }
  }
}