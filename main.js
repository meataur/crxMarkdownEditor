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

// The open documents
var docs = [];

// Tab-related variables
var isNewTabCreated = false;
var prevWorkingTabIdx = 0;
var srcTab = null;
var dragImage = null;

document.addEventListener('DOMContentLoaded', function() {
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
      "Shift-Ctrl-G": function() { return false; },
      "Shift-Ctrl-R": function() { return false; },
      "Alt-G": function() { return false; }
    }
  });
  editor.on("change", function(evt) {
    var parsed = parse(editor.getValue());
    var activeTab = Tab.getActive();
    if (activeTab) {
      // Update document title of tab
      var tab = activeTab.tab;
      var docTitle = tab.getElementsByClassName("doc-title")[0];
      docTitle.innerHTML = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";

      // Set mouse over title
      tab.title = docTitle.innerHTML;

      // Automatic preview rendering
      preview(parsed);
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

  // Load previous workspaces
  loadSettings();
  loadPrevWorks();

  // Check real-time JSON format
  document.getElementById('attachment-type').addEventListener('keyup', function() {
    try {
      JSON.parse(this.value);
      this.style["background"] = "#383838";
    } catch(e) {
      this.style["background"] = "rgb(238,97,80)";
    }
  });

  // Set buttons event handler
  document.getElementById("create-tab").onclick = Tab.addNew;

  document.getElementById('setting-jekyll-port').onkeypress = numberOnly;
  document.getElementById('btn-download-ruby').onclick = getRubyLang;
  document.getElementById('btn-download-jekyll').onclick = getJekyllStandalone;
  document.getElementById('btn-download-jekylllauncher').onclick = getJekyllLauncher;

  // Setting values onchange handlers
  document.getElementById('select-theme').onchange = selectTheme;
  document.getElementById('select-fontsize').onchange = selectFontsize;
  document.getElementById("setting-jekyll-localpath").onchange = function(e) {
    chrome.storage.local.set({ settingJekyllLocalpath: this.value.replace(/\\+$/, '') });
    messageBox("Auto Save");
  }
  document.getElementById("setting-jekyll-port").onchange = function(e) {
    chrome.storage.local.set({ settingJekyllPort: this.value.replace(/\\+$/, '') });
    messageBox("Auto Save");
  }

  // Set menu event handler of content panels
  Array.from(document.getElementsByClassName("panel-menu")).forEach(function(panelMenu) {
    Array.from(panelMenu.children).forEach(function(panelMenuItem) {
      var dropdown = panelMenuItem.getElementsByClassName("dropdown")[0];
      if (dropdown) {
        // Add caret to panel item
        panelMenuItem.classList.add("has-dropdown");
        
        // Set dropdown menu item's event handler
        Array.from(dropdown.children).forEach(function(dropdownItem) {
          dropdownItem.addEventListener("mouseover", function(e) { this.classList.add("highlight"); e.stopPropagation(); });
          dropdownItem.addEventListener("mouseout", function(e) { this.classList.remove("highlight"); });
          dropdownItem.addEventListener("mousedown", function(e) { e.stopPropagation(); });
          dropdownItem.addEventListener("click", function(e) {
            collapseAllDropdowns();
            deselectAllTempPanelMenuItems();
            closeAllDialogs();
          });
        });
      }

      panelMenuItem.addEventListener("mouseover", function(e) { this.classList.add("highlight"); });
      panelMenuItem.addEventListener("mouseout", function(e) { this.classList.remove("highlight"); });
      panelMenuItem.addEventListener("mousedown", function(e) {
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
  document.getElementById("editor-tools-template").onclick = initTextarea;
  document.getElementById("editor-tools-attachment").onclick = attachments;
  document.getElementById("editor-tools-prettify").onclick = prettify;
  document.getElementById("editor-tools-updtdatetime").onclick = resetPostingTime;
  document.getElementById("editor-tools-settings").onclick = openEditorSettingsPanel;

  document.getElementById("viewer-tools-export-html").onclick = IO.Local.saveAsHtml;
  document.getElementById("viewer-tools-export-pdf").onclick = IO.Local.saveAsPdf;
  document.getElementById("viewer-tools-print").onclick = IO.Local.print;
  document.getElementById("viewer-tools-expand").onclick = expandViewer;
  document.getElementById("viewer-tools-settings").onclick = openPanelViewerSettingsPanel;

  document.getElementById("localhost-tools-jekyll-setup").onclick = setupJekyll;
  document.getElementById("localhost-tools-run-jekyll").onclick = runJekyll;
  document.getElementById("localhost-tools-visit-site").onclick = visitJekyllSite;

  document.getElementById("help-tools-md-tutorial").onclick = openMdTutorial;
  document.getElementById("help-tools-about").onclick = openAboutPage;

  // Prevent event propagation on dialogs
  Array.from(document.getElementsByClassName("dlg")).forEach(function(dialog) {
    dialog.addEventListener("mousedown", function(e) {
      e.stopPropagation();
    });
  });

  // Enable panel splitter dragging
  splitter.onmousedown = function(e) {
    isPanelResizing = true;
  };
  splitter.ondblclick = function(e) {
    panelEditor.style.width = "calc(50% - " + (splitter.clientWidth / 2) + "px)";
    panelWrapperHelper.style.width = "calc(50% - " + (splitter.clientWidth / 2) + "px)";
  };
  document.onmousemove = function(e) {
    if (!isPanelResizing) return;

    var wrapper = document.getElementsByTagName("content")[0];
    var offset = e.clientX - wrapper.offsetLeft;
    if (offset < 400 || (wrapper.clientWidth - offset) < 400) return;

    var ratio = offset / wrapper.clientWidth * 100;
    panelEditor.style.width = "calc(" + ratio + "% - " + (splitter.clientWidth / 2) + "px)";
    panelWrapperHelper.style.width = "calc(" + (100 - ratio) + "% - " + (splitter.clientWidth / 2) + "px)";
  };
  document.onmouseup = function(e) {
    // Escape from panel resizing mode
    isPanelResizing = false;
  };
  document.onmousedown = function(e) {
    collapseAllDropdowns();
    deselectAllTempPanelMenuItems();
    closeAllDialogs();
  };
  
  // Keyboard shortcut
  document.onkeydown = function(e) {
    if (e.ctrlKey) {
      switch (e.which) {
      case 79:                // Ctrl + O
        e.preventDefault();
        IO.Local.open();
        break;
      case 81:                // Ctrl + Q (for testing)
        e.preventDefault();
        messageBox("test");
        break;
      case 83:                // Ctrl + S
        e.preventDefault();
        IO.Local.save();
        break;
      }
    } else {
      switch (e.which) {
    case 27:                  // Escape key
        e.preventDefault();
        closeAllDialogs();
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
          texts_original: docs[i].texts_original,
          texts: editor.getValue(),
          scrollbar: editor.getScrollInfo(),
          cursor: editor.getCursor(),
          viewer_scroll: document.getElementById("viewer").scrollTop,
          active: true
        };
        chrome.storage.local.set({ documents: docs });
        break;
      }
    }
  }

  // The 'window.onresize' callback function is called after printing.
  window.onresize = function(e) {
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
  };
});

function messageBox(texts, duration) {
  if (typeof(duration) === "undefined")
    duration = texts.length * 60;
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
  setTimeout(function() {
    msgbox.style.opacity = 1;
  }, 100);
  setTimeout(function() {
    msgbox.style.opacity = 0;
    setTimeout(function() {
      msgbox.parentNode.removeChild(msgbox);
    }, 300);
  }, duration);
}



/**
 * Workspaces
 */

function loadSettings() {
  chrome.storage.local.get('settingJekyllLocalpath', function(result) {
    document.getElementById("setting-jekyll-localpath").value = result.settingJekyllLocalpath ? result.settingJekyllLocalpath : "";
  });
  chrome.storage.local.get("settingJekyllPort", function(result) {
    document.getElementById("setting-jekyll-port").value = result.settingJekyllPort ? result.settingJekyllPort : 4000;
  });
  chrome.storage.local.get('theme', function(result) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "themes.css");
    xhr.onload = function() {
      var themeselector = document.getElementById("select-theme");

      // Insert theme options
      var lines = xhr.responseText.match(/[^\r\n]+/g);
      lines.forEach(function(line) {
        var cssPath = line.match(/".*?"/g)[0].replace(/"/gi,"");
        var option = document.createElement("option");
        option.innerHTML = cssPath.replace(/^.*[\\\/]/, "").replace(/\.[^/.]+$/, "");
        themeselector.appendChild(option);
      });

      // Select editor's theme
      themeselector.value = result.theme ? result.theme : "default";
      selectTheme();
    }
    xhr.send();
  });
  chrome.storage.local.get('fontsize', function(result) {
    var fontsizeselector = document.getElementById("select-fontsize");

    // Insert font-size options
    var fontsizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32];
    fontsizes.forEach(function(fontsize) {
      var option = document.createElement("option");
      option.innerHTML = fontsize;
      fontsizeselector.appendChild(option);
    });

    // Select editor's font size
    fontsizeselector.value = result.fontsize ? result.fontsize : "13";
    selectFontsize();
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
      document.getElementById('attachment-type').style["background"] = "#383838";
    } else {
      document.getElementById('attachment-type').value = '{\n  "img": ["png","jpg","jpeg","gif","bmp"],\n  "pdf": ["pdf"],\n  "doc": ["doc","docx","ppt","pptx","xls","xlsx","hwp","txt","html","htm"]\n}';
      document.getElementById('attachment-type').style["background"] = "#383838";
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
  chrome.storage.local.get('viewer_baseurl', function(result) {
    if (result.viewer_baseurl) {
      document.getElementById('viewer-baseurl').value = result.viewer_baseurl;
      document.getElementById('viewer-baseurl').style["background"] = "#383838";
    } else {
      document.getElementById('viewer-baseurl').value = 'http://localhost:4000';
      document.getElementById('viewer-baseurl').style["background"] = "#383838";
    }
  });
}

function saveSettings() {
  var themeselector = document.getElementById("select-theme");
  var fontsizeselector = document.getElementById("select-fontsize");
  
  chrome.storage.local.set({
    'theme': themeselector.options[themeselector.selectedIndex].textContent,
    'fontsize': fontsizeselector.options[fontsizeselector.selectedIndex].textContent,
    'attachment_location': document.getElementById('attachment-location').value.replace(/\/+$/, ''),
    'hashing': document.querySelector('input[name="hashing"]:checked').value,
    'viewer_baseurl': document.getElementById('viewer-baseurl').value
  });

  try {
    // JSON parsing test
    JSON.parse(document.getElementById('attachment-type').value);

    chrome.storage.local.set({
      'attachment_type': document.getElementById('attachment-type').value
    });

    return true;
  } catch(e) {
    return false;
  }
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
          var docTitle = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";

          // Create tab
          var tab = Tab.create(docTitle);
          if (doc.active) activeTab = tab;
          
          // Add tab
          ul.insertBefore(tab, ul.children[ul.children.length - 1]);
        });

        // Click active tab
        if (activeTab) activeTab.mousedown();
      } else {
        Tab.addNew();
      }
    } else {
      Tab.addNew();
    }

    Tab.resize();
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
  Array.from(panelWrapperHelper.getElementsByClassName("hpage")).forEach(function(hpage) {
    hpage.style.display = "none";
  });
  Array.from(panelWrapperHelper.getElementsByClassName("panel-menu")).forEach(function(panelMenu) {
    Array.from(panelMenu.children).forEach(function(panelMenuItem) {
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
  Array.from(document.getElementsByClassName("dropdown")).forEach(function(dropdown) {
    dropdown.style.display = "none";
  });
}

function deselectAllPanelMenuItems() {
  Array.from(document.getElementsByClassName("panel-menu")).forEach(function(panelMenu) {
    Array.from(panelMenu.children).forEach(function(panelMenuItem) {
      panelMenuItem.classList.remove("selected");
    });
  });
}

function deselectAllTempPanelMenuItems() {
  Array.from(document.getElementsByClassName("panel-menu")).forEach(function(panelMenu) {
    Array.from(panelMenu.children).forEach(function(panelMenuItem) {
      if (panelMenuItem.classList.contains("has-dropdown"))
        panelMenuItem.classList.remove("selected");
    });
  });
}

function closeAllDialogs() {
  Array.from(document.getElementsByClassName("dlg")).forEach(function(dialog) {
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
    this.getElementsByTagName("span")[0].innerHTML = "back to editor";
    document.getElementsByTagName("header")[0].style.display = "none";
    document.getElementsByTagName("content")[0].style.height = "calc(100vh)";
    document.getElementById("viewer").getAncestorByClassName("panel-body").style.height = "calc(100vh - " + panelHeaderHeight + "px)";
    panelEditor.style.display = "none";
    splitter.style.display = "none";
    panelWrapperHelper.style.width = "100%";
  }
}

function openPanelViewerSettingsPanel() {
  var div = document.getElementById("viewer-settings");
  div.style.display = "block";
  document.getElementById("viewer-baseurl").focus();
}

function setupJekyll() {
  closeAllHelperPanelPages();
  document.getElementById("hpage-jekyll-setup").style.display = "block";
  document.getElementById("localhost-tools-jekyll-setup").classList.add("selected");
  document.getElementById("localhost-panel-title").innerHTML = "localhost setup";
}

function runJekyll() {
  var port = document.getElementById("setting-jekyll-port").value;
  if (!port) {
    messageBox("Invalid localhost port!");
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    messageBox("Jekyll is now running on port " + port + ".");
  }
  xhr.onerror = function() {
    chrome.runtime.sendNativeMessage("jekyllserve" + port, { text: "" }, function(response) {
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
  var port = document.getElementById("setting-jekyll-port").value;
  if (!port) {
    messageBox("Invalid localhost port!");
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    window.open("http://localhost:" + port);
  }
  xhr.onerror = function() {
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
    document.getElementById("hpage-md-tutorial").innerHTML = data;
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

function openEditorSettingsPanel() {
  var div = document.getElementById("editor-settings");
  div.style.display = "block";
  document.getElementById("select-theme").focus();
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
  chrome.tabs.create({ url: "https://rubyinstaller.org/downloads/" });
}

function getJekyllStandalone() {
  chrome.downloads.download({
    url: "https://github.com/ChangUk/jekyll-standalone/archive/master.zip",
    filename: "jekyll-standalone.zip",
    conflictAction: "overwrite"
  });
}

function getJekyllLauncher() {
  var workingDirectory = document.getElementById("setting-jekyll-localpath").value;
  if (!workingDirectory) {
    messageBox("Invalid working directory path!");
    return;
  }

  var localhostPort = document.getElementById("setting-jekyll-port").value;
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
  zip.generateAsync({ type: "blob" }).then(function(zipped) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(zipped);
    a.download = "jekyll_launcher.zip";
    a.click();
  });
}

function selectTheme() {
  var selector = document.getElementById("select-theme");
  var theme = selector.options[selector.selectedIndex].textContent;
  editor.setOption("theme", theme);
}

function selectFontsize() {
  var selector = document.getElementById("select-fontsize");
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

    return template;
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

  input.click();
}

var Working = Object.freeze({ "READY": {}, "METADATA": {}, "BODY": {} });

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
  for (var i = 0; i < lines.length; i++) {
    // Current line texts
    var curLine = lines[i];

    // Work with current line
    if (curState == Working.READY) {
      curLine = curLine.trim();
      if (!curLine.length)
        continue;

      if (curLine.startsWith("---")) {    // At the beginning of post header
        curState = Working.METADATA;
      } else {
        curState = Working.BODY;
        i--;
      }
    } else if (curState == Working.METADATA) {
      curLine = curLine.trim();
      if (!curLine.length)
        continue;

      if (curLine.startsWith("---")) {    // At the end of post header
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

function preview(parsed) {
  if (editor) {
    var data = "";
    if (parsed.header.title && parsed.header.title.length)
      data += "# " + parsed.header.title + "\n\n";
    if (parsed.body.texts.length)
      data += parsed.body.texts;

    // Set site's base url to localhost
    var baseurl = document.getElementById("viewer-baseurl").value;
    data = data.replace(/{{ site.baseurl }}/gi, baseurl);
    
    // Show preview panel
    var viewer = document.getElementById("viewer");
    var data = converter.makeHtml(data);
    if (data.length) {
      viewer.removeAllChildren();
      viewer.innerHTML = data;
    } else {
      viewer.removeAllChildren();
      var noContent = document.createElement("div");
      noContent.classList.add("no-content");
      noContent.innerHTML = "There is nothing displayed on viewer.";
      viewer.appendChild(noContent);
    }
  }
}
