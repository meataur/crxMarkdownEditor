// Load manifest data
var manifestData = chrome.runtime.getManifest();

// CodeMirro editor variable
var editor = null;

// Vertical panels
var contentWrapper = null;
var panelEditor = null;
var panelHelper = null;
var panelViewer = null;
var panelLocalhost = null;
var panelAbout = null;
var splitter = null;
var isPanelResizing = false;

// The variable storing current workspaces
var docs = [];

// Tab-related variables
var isNewTabCreated = false;
var prevWorkingTabIdx = 0;
var srcTab = null;
var dragImage = null;

// Cloud API keys
var gdriveApiKey = "AIzaSyDVcjhklCvt0NKtN9ithQOSJJfHU-QcAXY";

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
      docTitle.innerHTML = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";

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

  // Content panels and its splitter
  contentWrapper = document.getElementsByTagName("content")[0];
  panelEditor = document.getElementsByTagName("editor")[0];
  panelHelper = document.getElementsByTagName("helper")[0];
  panelViewer = document.getElementsByTagName("viewer")[0];
  panelLocalhost = document.getElementsByTagName("localhost")[0];
  panelAbout = document.getElementsByTagName("about")[0];
  splitter = document.getElementsByTagName("splitter")[0];

  // Panel selection
  document.getElementById('menu-viewer').onclick = openViewer;
  document.getElementById('menu-localhost').onclick = openPanelLocalhost;
  document.getElementById('menu-about').onclick = openAbout;
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
  document.getElementById("create-tab").onclick = addNewTab;

  document.getElementById('setting-jekyll-port').onkeypress = numberOnly;
  document.getElementById('btn-download-ruby').onclick = getRubyLang;
  document.getElementById('btn-download-jekyll').onclick = getJekyllStandalone;
  document.getElementById('btn-download-jekylllauncher').onclick = getJekyllLauncher;

  // Setting values onchange handlers
  document.getElementById('select-theme').onchange = selectTheme;
  document.getElementById('select-fontsize').onchange = selectFontsize;
  document.getElementById("setting-jekyll-localpath").onchange = function(e) {
    chrome.storage.local.set({ settingJekyllLocalpath: document.getElementById("setting-jekyll-localpath").value.replace(/\\+$/, '') });
    messageBox("Auto Save");
  }
  document.getElementById("setting-jekyll-port").onchange = function(e) {
    chrome.storage.local.set({ settingJekyllPort: document.getElementById("setting-jekyll-port").value.replace(/\\+$/, '') });
    messageBox("Auto Save");
  }

  // Set menu event handler of content panels
  Array.from(document.getElementsByClassName("panelmenu")).forEach(function(panelMenu) {
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
            deselectAllPanelmenuItems();
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
          deselectAllPanelmenuItems();
        } else {
          // Deselect all panel menu items
          deselectAllPanelmenuItems();

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

  document.getElementById("editor-tools-import-local").onclick = openLocalFile;
  document.getElementById("editor-tools-import-gdrive").onclick = importFromGoogleDrive;
  document.getElementById("editor-tools-save-local").onclick = saveAsLocalFile;
  document.getElementById("editor-tools-save-gdrive").onclick = saveToGoogleDrive;
  document.getElementById("editor-tools-template").onclick = initTextarea;
  document.getElementById("editor-tools-attachment").onclick = attachments;
  document.getElementById("editor-tools-prettify").onclick = prettify;
  document.getElementById("editor-tools-updtdatetime").onclick = resetPostingTime;
  document.getElementById("editor-tools-settings").onclick = openEditorSettingsPanel;

  document.getElementById("viewer-tools-export-html").onclick = saveAsHtml;
  document.getElementById("viewer-tools-export-pdf").onclick = saveAsPdf;
  document.getElementById("viewer-tools-print").onclick = printPreview;
  document.getElementById("viewer-tools-expand").onclick = expandViewer;
  document.getElementById("viewer-tools-settings").onclick = openViewerSettingsPanel;

  document.getElementById("localhost-tools-run-jekyll").onclick = runJekyll;

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
    panelHelper.style.width = "calc(50% - " + (splitter.clientWidth / 2) + "px)";
  };
  document.onmousemove = function(e) {
    if (!isPanelResizing) return;

    var offset = e.clientX - contentWrapper.offsetLeft;
    if (offset < 400 || (contentWrapper.clientWidth - offset) < 400) return;

    var ratio = offset / contentWrapper.clientWidth * 100;
    panelEditor.style.width = "calc(" + ratio + "% - " + (splitter.clientWidth / 2) + "px)";
    panelHelper.style.width = "calc(" + (100 - ratio) + "% - " + (splitter.clientWidth / 2) + "px)";
  };
  document.onmouseup = function(e) {
    // Escape from panel resizing mode
    isPanelResizing = false;
  };
  document.onmousedown = function(e) {
    collapseAllDropdowns();
    deselectAllPanelmenuItems();
    closeAllDialogs();
  };
  
  // Keyboard shortcut
  document.onkeydown = function(e) {
    if (e.ctrlKey) {
      switch (e.which) {   // Ctrl + S
      case 83:
        e.preventDefault();
        saveAsLocalFile();
        break;
      case 88:             // Ctrl + X (for testing)
        e.preventDefault();
        importFromGoogleDrive();
        break;
      }
    } else {
      switch (e.which) {
      case 27:             // Escape key
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
          last_modified: docs[i].last_modified,
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

  window.onresize = function(e) {
    resizeTabWidths();

    if (panelEditor.clientWidth <= 400) {
      var ratio = 400 / contentWrapper.clientWidth * 100;
      panelEditor.style.width = "calc(" + ratio + "% - " + (splitter.clientWidth / 2) + "px)";
      panelHelper.style.width = "calc(" + (100 - ratio) + "% - " + (splitter.clientWidth / 2) + "px)";
    } else if (panelHelper.clientWidth <= 400) {
      var ratio = 400 / contentWrapper.clientWidth * 100;
      panelEditor.style.width = "calc(" + (100 - ratio) + "% - " + (splitter.clientWidth / 2) + "px)";
      panelHelper.style.width = "calc(" + ratio + "% - " + (splitter.clientWidth / 2) + "px)";
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

  var msgbox = document.createElement("messagebox");
  msgbox.innerHTML = texts.replace(/\n/g, '<br />');
  document.body.appendChild(msgbox);
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
    xhr.onloadend = function() {
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
          var docDatetime = doc.last_modified.split(' ')[0];
          var docTitle = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";

          // Create tab
          var tab = createTab(docDatetime, docTitle);
          if (doc.active) activeTab = tab;
          
          // Add tab
          ul.insertBefore(tab, ul.children[ul.children.length - 1]);
        });

        // Click active tab
        if (activeTab) activeTab.mousedown();
      } else {
        addNewTab();
      }
    } else {
      addNewTab();
    }

    resizeTabWidths();
  });
}



/**
 * tabs
 */

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
  li.style.width = 0;
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
    var dstTab = e.target.getAncestorByTagName("li");
    if (dstTab) {
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
    var activeTab = getActiveTab();
    if (activeTab) {
      var i = activeTab.index;
      
      docs[i].texts = editor.getValue();
      docs[i].scrollbar = editor.getScrollInfo();
      docs[i].cursor = editor.getCursor();
      docs[i].viewer_scroll = document.getElementById("viewer").scrollTop;
      docs[i].active = false;
      prevWorkingTabIdx = i;

      // Remove active attribute
      activeTab.tab.removeAttribute("active");

      // Remove tab-close button
      activeTab.tab.removeChild(activeTab.tab.getElementsByClassName("tab-close")[0]);
    }

    // Load selected document texts
    this.setAttribute("active", "");
    activeTab = getActiveTab();
    if (activeTab) {
      var i = activeTab.index;

      // Load editing environment
      editor.setValue(docs[i].texts);
      editor.scrollTo(docs[i].scrollbar.left, docs[i].scrollbar.top);
      document.getElementById("viewer").scrollTop = docs[i].viewer_scroll;
      editor.focus();
      editor.setCursor(docs[i].cursor.line, docs[i].cursor.ch);

      // Set browser tab title
      document.title = manifestData.name + " - " + activeTab.tab.getElementsByClassName("doc-title")[0].innerHTML;

      // Set active
      docs[i].active = true;

      // Activate tab-close button
      var divClose = document.createElement("div");
      divClose.className = "tab-close";
      divClose.title = "Close tab";
      divClose.innerHTML = "<svg><use xlink:href=\"icons.svg#icon-tab-close\"></use></svg>";
      divClose.onclick = closeTab;

      // Attach tab-close button to each tab
      activeTab.tab.appendChild(divClose);
    }

    // Save current workspace
    chrome.storage.local.set({ documents: docs });

    // Release tab creation flag
    isNewTabCreated = false;
  });

  return li;
}

function addNewTab() {
  var ul = document.getElementById("tabs");

  if (ul.children.length >= 10)
    document.getElementById("create-tab").style.display = "none";

  // Create new tab
  var newtab = createTab(getCurDatetimeString().split(' ')[0], "Untitled Document");
  ul.insertBefore(newtab, ul.children[ul.children.length - 1]);

  // Add empty document to list
  docs.push({
    last_modified: "",
    texts_original: "",
    texts: "",
    scrollbar: { left: 0, top: 0 },
    cursor: { line: 0, ch: 0 },
    viewer_scroll: 0,
    active: false
  });

  // Adjust tab widths
  resizeTabWidths();

  // Click newly-created tab
  newtab.mousedown();

  // Set default format
  var template = initTextarea();
  docs[docs.length - 1].texts_original = template;
  docs[docs.length - 1].texts = template;

  // Set tab creation flag
  isNewTabCreated = true;
}

function closeTab() {
  // Not to ask if confirmed to close the tab if the previous work is empty
  var activeTab = getActiveTab();
  var parsed = parse(editor.getValue());
  if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
    if (!confirm("Changes you made may not be saved.\nAre you sure to close the tab?"))
      return;
  }

  var tabs = document.getElementsByClassName("tab");
  var nTabs = tabs.length - 1;
  if (nTabs == 1) {
    initTextarea();
    return;
  } else if (nTabs == 10) {
    document.getElementById("create-tab").style.display = "block";
  }

  if (activeTab) {
    // Move to another tab
    if (activeTab.index === nTabs - 1) {
      if (isNewTabCreated) {
        tabs[prevWorkingTabIdx].mousedown();
        isNewTabCreated = false;
      } else {
        tabs[activeTab.index - 1].mousedown();
      }
    } else {
      tabs[activeTab.index + 1].mousedown();
    }

    // Remove from document list
    docs.splice(activeTab.index, 1);
    chrome.storage.local.set({ "documents": docs });
    
    // Tab removal animation
    activeTab.tab.innerHTML = "";
    activeTab.tab.style.padding = 0;
    activeTab.tab.style.width = 0;
    setTimeout(function() {
      document.getElementById("tabs").removeChild(activeTab.tab);
      resizeTabWidths();
    }, 300);
  }
}

function resizeTabWidths() {
  var bodyWidth = parseInt(window.getComputedStyle(document.body).width);
  var menuWidth = 0;
  Array.from(document.getElementsByClassName("menuitem")).forEach(function(menuItem) {
    menuWidth += parseInt(window.getComputedStyle(menuItem).width);
  });

  var tabs = document.getElementsByClassName("tab");
  var addTabBtn = document.getElementById("create-tab");
  var addTabBtnWidth = parseInt(window.getComputedStyle(addTabBtn).width);
  if (addTabBtn.style.display === "none")
    addTabBtnWidth = 0;
  var newWidth = (bodyWidth - menuWidth - addTabBtnWidth - 80) / (tabs.length - 1);
  if (newWidth > 180) newWidth = 180;
  Array.from(tabs).forEach(function(tab) {
    if (tab.id !== "create-tab")
      tab.style.width = newWidth + "px";
  });
}



/**
 * Panels
 */

function closeAllPanels() {
  panelViewer.style.display = "none";
  document.getElementById("menu-viewer").style.color = "unset";
  panelLocalhost.style.display = "none";
  document.getElementById("menu-localhost").style.color = "unset";
  panelAbout.style.display = "none";
  document.getElementById("menu-about").style.color = "unset";
}

function openViewer() {
  closeAllPanels();
  panelViewer.style.display = "block";
  document.getElementById("menu-viewer").style.color = "#fff";
}

function openPanelLocalhost() {
  closeAllPanels();
  panelLocalhost.style.display = "block";
  document.getElementById("menu-localhost").style.color = "#fff";
}

function openAbout() {
  closeAllPanels();
  panelAbout.style.display = "block";
  document.getElementById("menu-about").style.color = "#fff";
}



/**
 * Dropdown menu
 */

function adjustDropdownPosition(el) {
  var dropdown = el.getElementsByClassName("dropdown")[0];
  if (dropdown.style.display === "none")
    return;
  
  var containerWidth = parseInt(window.getComputedStyle(el.getAncestorByClassName("vpanel-header")).width);
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

function deselectAllPanelmenuItems() {
  Array.from(document.getElementsByClassName("selected")).forEach(function(selected) {
    selected.classList.remove("selected");
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

function createIframe(docTitle) {
  var ifrm = document.createElement("iframe");
  ifrm.style.position = "absolute";
  ifrm.style.display = "none";
  document.body.appendChild(ifrm);

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "preview.css");
  xhr.onloadend = function() {
    ifrm.contentWindow.document.open();
    ifrm.contentWindow.document.write("<html>\n<head>\n<title>" + docTitle + "</title>\n");
    ifrm.contentWindow.document.write("<style>" + xhr.responseText + "</style>\n");
    ifrm.contentWindow.document.write("</head>\n");
    ifrm.contentWindow.document.write("<body id=\"viewer\">\n" + document.getElementById("viewer").innerHTML + "</body>\n");
    ifrm.contentWindow.document.write("</html>");
    ifrm.contentWindow.document.close();
  }
  xhr.send();

  return ifrm;
}

function saveAsHtml() {
  var docTitle = getActiveTab().tab.getElementsByClassName("doc-title")[0].innerHTML;
  var filename = docTitle + ".html";
  var ifrm = createIframe(docTitle);

  // Create download link element
  setTimeout(function() {
    chrome.downloads.download({
      url: "data:text/html;charset=utf-8," + encodeURIComponent(ifrm.contentWindow.document.documentElement.outerHTML),
      filename: filename,
      conflictAction: "overwrite",
      saveAs: true
    }, function(downloadId) {
      chrome.downloads.onChanged.addListener(function(e) {
        if (e.id == downloadId && e.state && e.state.current === "complete") {
          messageBox("Download Complete!");
        }
        document.body.removeChild(ifrm);
      })
    });
  }, 500);
}

function saveAsPdf() {
  messageBox("Not support yet...");
}

function printPreview() {
  var docTitle = getActiveTab().tab.getElementsByClassName("doc-title")[0].innerHTML;
  var ifrm = createIframe(docTitle);
  setTimeout(function () {
    ifrm.contentWindow.focus();
    ifrm.contentWindow.print();
    document.body.removeChild(ifrm);
  }, 500);
}

function expandViewer() {
  if (this.hasAttribute("expanded")) {
    this.removeAttribute("expanded");
    this.getElementsByTagName("span")[0].innerHTML = "expand screen";
    document.getElementsByTagName("header")[0].style.display = "block";
    document.getElementsByTagName("content")[0].style.height = "calc(100vh - 60px)";
    document.getElementById("viewer").getAncestorByClassName("vpanel-body").style.height = "calc(100vh - 105px)";
    panelEditor.style.display = "block";
    splitter.style.display = "block";
    panelHelper.style.width = "calc(50% - " + (splitter.clientWidth / 2) + "px)";
  } else {
    this.setAttribute("expanded", "");
    this.getElementsByTagName("span")[0].innerHTML = "back to editor";
    document.getElementsByTagName("header")[0].style.display = "none";
    document.getElementsByTagName("content")[0].style.height = "calc(100vh)";
    document.getElementById("viewer").getAncestorByClassName("vpanel-body").style.height = "calc(100vh - 45px)";
    panelEditor.style.display = "none";
    splitter.style.display = "none";
    panelHelper.style.width = "100%";
  }
}

function openViewerSettingsPanel() {
  var div = document.getElementById("viewer-settings");
  div.style.display = "block";
  document.getElementById("viewer-baseurl").focus();
}

function runJekyll() {
  document.getElementById('localhost-tools-run-jekyll').disabled = true;
  var localhost_port = document.getElementById("setting-jekyll-port").value;
  if (!localhost_port) {
    messageBox("Invalid localhost port!");
    document.getElementById('localhost-tools-run-jekyll').disabled = false;
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.addEventListener("load", function() {
    messageBox("Jekyll is now running on port " + localhost_port + ".");
    document.getElementById('localhost-tools-run-jekyll').disabled = false;
  });
  xhr.addEventListener("error", function() {
    chrome.runtime.sendNativeMessage("jekyllserve" + localhost_port, { text: "" }, function(response) {
      if (!response) {
        var lastError = chrome.runtime.lastError;
        if (lastError) {
          if (lastError.message == "Access to the specified native messaging host is forbidden.") {
            // Do nothing
            messageBox("Invalid \"allowed_origins\" value in manifest JSON file!\nRe-install Jekyll Launcher.");
          } else if (lastError.message == "Specified native messaging host not found.") {
            // Not found host application
            messageBox("Not found host application!\nInstall Jekyll Launcher to be running on port " + localhost_port + ".");
          } else if (lastError.message == "Error when communicating with the native messaging host.") {
            // Jekyll is shut down.
          } else {
            // Do nothing
            messageBox("Unknown error occurred!");
          }
        }
      }
      document.getElementById('localhost-tools-run-jekyll').disabled = false;
    });
  });
  xhr.open("GET", "http://localhost:" + localhost_port + "/", true);
  xhr.send();
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

      if (curLine.startsWith("---")) {    // At the beginning of post header
        curState = Working.HEADER;
      }
    } else if (curState == Working.HEADER) {
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

function openLocalFile() {
  // Not to ask if confirmed to open another document if the previous work is empty
  var activeTab = getActiveTab();
  var parsed = parse(editor.getValue());
  if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
    if (!confirm("Changes you made may not be saved.\nAre you sure to open another document?"))
      return;
  }

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

        docs[activeTab.index].texts_original = editor.getValue();
      }
    };
    reader.readAsText(e.target.files[0]);
  });
  input.click();
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
    // ifrm.innerHTML += "<meta charset='utf-8'>";
    // ifrm.innerHTML += "<meta http-equiv='X-UA-Compatible' content='IE=edge'>";
    // ifrm.innerHTML += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    // ifrm.innerHTML += "<link rel='stylesheet' href='preview/preview.css'>";
    // ifrm.innerHTML += "<script type='text/javascript' src='preview/jquery/3.3.1/jquery.min.js'></script>";
    // ifrm.innerHTML += "<link rel='stylesheet' href='preview/font-awesome/4.7.0/css/font-awesome.min.css'>";
    // ifrm.innerHTML += "<script type='text/x-mathjax-config' src='preview/preview.js'></script>";
    // ifrm.innerHTML += "<script type='text/javascript' async src='preview/mathjax/2.7.4/MathJax.js'></script>";
    viewer.innerHTML = marked(data);
  }
}

function saveAsLocalFile() {
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
    }, function(downloadId) {
      chrome.downloads.onChanged.addListener(function(e) {
        if (e.id == downloadId && e.state && e.state.current === "complete") {
          // Display alert message
          messageBox("Download Complete!");

          // Save workspace data
          var activeTab = getActiveTab();
          docs[activeTab.index] = {
            last_modified: docs[activeTab.index].last_modified,
            texts_original: editor.getValue(),
            texts: editor.getValue(),
            scrollbar: editor.getScrollInfo(),
            cursor: editor.getCursor(),
            viewer_scroll: document.getElementById("viewer").scrollTop,
            active: true
          };
        }
      })
    });
  }
}

function filetree(parent, access_token, fileid) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://www.googleapis.com/drive/v3/files?q='" + fileid + "'+in+parents");
  xhr.setRequestHeader("Authorization", "Bearer " + access_token)
  xhr.onload = function() {
    var ul = document.createElement("ul");
    ul.id = fileid;
    var data = JSON.parse(xhr.response);
    data.files.forEach(function(fileinfo) {
      if (fileinfo.mimeType === "application/vnd.google-apps.folder") {
        var li = document.createElement("li");
        li.style.color = "#a8afbd";
        li.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>" + fileinfo.name + "</span>";
        li.onmouseover = function(e) {
          e.stopPropagation();
          this.style.color = "#fff";
        };
        li.onmouseout = function(e) {
          e.stopPropagation();
          this.style.color = "#a8afbd";
        }
        li.onclick = function(e) {
          e.stopPropagation();

          var subtree = this.getElementsByTagName("ul");
          if (subtree.length) {
            this.removeChild(subtree[0]);
          } else {
            filetree(this, access_token, fileinfo.id);
          }
        };
        ul.appendChild(li);
      } else if (fileinfo.mimeType === "application/vnd.google-apps.document") {
        var li = document.createElement("li");
        li.style.color = "#a8afbd";
        li.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-file\"></use></svg><span>" + fileinfo.name + "</span>";
        li.onmouseover = function(e) {
          e.stopPropagation();
          this.style.color = "#fff";
        };
        li.onmouseout = function(e) {
          e.stopPropagation();
          this.style.color = "#a8afbd";
        }
        li.onclick = function(e) {
          e.stopPropagation();

          // Get file content
          var xhr2 = new XMLHttpRequest();
          xhr2.open("GET", "https://www.googleapis.com/drive/v3/files/" + fileinfo.id + "/export?mimeType=text/plain");
          xhr2.setRequestHeader("Authorization", "Bearer " + access_token);
          xhr2.onload = function() {
            var activeTab = getActiveTab();
            var parsed = parse(editor.getValue());
            if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
              if (!confirm("Changes you made may not be saved.\nAre you sure to open another document?"))
                return;
            }

            editor.setValue(xhr2.response);
            editor.focus();
            editor.setCursor(0, 0);

            docs[activeTab.index].texts_original = editor.getValue();
          };
          xhr2.send();

          // Close dialog
          closeAllDialogs();
        };
        ul.appendChild(li);
      }
    });

    if (!ul.hasChildNodes()) {
      var li = document.createElement("li");
      li.style.color = "#a8afbd";
      li.innerHTML = "(empty)";
      li.onmouseover = function(e) {
        e.stopPropagation();
        this.style.color = "#fff";
      };
      li.onmouseout = function(e) {
        e.stopPropagation();
        this.style.color = "#a8afbd";
      }
      ul.appendChild(li);
    }

    parent.appendChild(ul);
  }
  xhr.send();
}

function importFromGoogleDrive() {
  var dialog = document.getElementById("editor-import-gdrive");
  dialog.style.display = "block";
  var importList = document.getElementById("importlist-gdrive");
  importList.removeAllChildren();

  chrome.identity.getAuthToken({ interactive: true }, function(access_token) {
    filetree(importList, access_token, "root");
  });
}

function saveToGoogleDrive() {
  // var dialog = document.getElementById("editor-export-gdrive");
  // dialog.style.display = "block";
  // var exportList = document.getElementById("exportlist-gdrive");
  // exportList.removeAllChildren();
  chrome.identity.getAuthToken({ interactive: true }, function(access_token) {
    var data = "--mdeditor_create_file\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{ \"name\": \"ccc\", \"mimeType\": \"application/vnd.google-apps.document\", \"parents\": [\"root\"] }\r\n\r\n--mdeditor_create_file\r\nContent-Type: text/plain\r\n\r\nHello\r\n--mdeditor_create_file\r\n";

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
    xhr.setRequestHeader("Authorization", "Bearer " + access_token);
    xhr.setRequestHeader("Content-Type", "multipart/related; boundary=mdeditor_create_file");
    xhr.onload = function() {
      console.log(this.response);
    };
    xhr.send(data);
  });
}
