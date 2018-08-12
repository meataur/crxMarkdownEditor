IO.GDrive = (function () {
  let _getAuthToken = function (options) {
    chrome.identity.getAuthToken({
      interactive: options.interactive
    }, options.callback);
  }
  let _xhrWithToken = function (method, url, access_token, callback, data) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
    xhr.onload = callback;
    data ? xhr.send(data) : xhr.send();
  }
  let _impFiletree = function (parent, access_token, fileid) {
    var importList = document.getElementById("importlist-gdrive");
    IO.Spinner.show(importList, "spinner-gdrive-import");

    _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files?q='" + fileid + "'+in+parents+and+trashed=false", access_token, function () {
      IO.Spinner.hide("spinner-gdrive-import");

      if (this.status == 200) {
        var ul = document.createElement("ul");
        var data = JSON.parse(this.response);
        data.files.forEach(function (fileinfo) {
          if (fileinfo.mimeType === "application/vnd.google-apps.folder") {
            var li = document.createElement("li");
            li.setAttribute("data", fileinfo.id);
            li.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>" + fileinfo.name + "</span>";
            li.onmouseover = function (e) {
              e.stopPropagation();
              this.classList.add("focused");
            }
            li.onmouseout = function (e) {
              e.stopPropagation();
              this.classList.remove("focused");
            }
            li.ondblclick = function (e) {
              e.stopPropagation();

              // Prevent request duplication
              if (IO.Spinner.exists("spinner-gdrive-import")) return;

              var subtree = this.getElementsByTagName("ul");
              if (subtree.length) {
                this.removeChild(subtree[0]);
              } else {
                _impFiletree(this, access_token, this.getAttribute("data"));
              }
            }
            ul.appendChild(li);
          }
        });
        data.files.forEach(function (fileinfo) {
          if (fileinfo.mimeType === "application/vnd.google-apps.document") {
            var li = document.createElement("li");
            li.setAttribute("data", fileinfo.id);
            li.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-file\"></use></svg><span>" + fileinfo.name + "</span>";
            li.onmouseover = function (e) {
              e.stopPropagation();
              this.classList.add("focused");
            }
            li.onmouseout = function (e) {
              e.stopPropagation();
              this.classList.remove("focused");
            }
            li.onclick = function (e) {
              e.stopPropagation();

              Array.from(importList.getElementsByTagName("li")).forEach(function (li) {
                li.removeAttribute("selected");
              });
              this.setAttribute("selected", "");

              var importBtn = document.getElementById("btn-import-from-gdrive");
              importBtn.setAttribute("activated", "");
              importBtn.setAttribute("data", this.getAttribute("data"));
            }
            li.ondblclick = function (e) {
              e.stopPropagation();

              if (!IO.checkBeforeLeave()) return;

              IO.Spinner.show(importList, "spinner-gdrive-import");
              _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files/" + fileinfo.id + "/export?mimeType=text/plain", access_token, _cbReadFile);
            }
            ul.appendChild(li);
          }
        });

        parent.appendChild(ul);
      } else {
        messageBox("Unable to load files of Google Drive: Error code(" + this.status + ")");
      }
    });
  }
  let _expFiletree = function (parent, access_token, fileid) {
    var exportList = document.getElementById("exportlist-gdrive");
    IO.Spinner.show(exportList, "spinner-gdrive-export");

    _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files?q='" + fileid + "'+in+parents+and+trashed=false", access_token, function () {
      IO.Spinner.hide("spinner-gdrive-export");

      if (this.status == 200) {
        var ul = document.createElement("ul");
        var data = JSON.parse(this.response);
        data.files.forEach(function (fileinfo) {
          if (fileinfo.mimeType === "application/vnd.google-apps.folder") {
            var li = document.createElement("li");
            li.setAttribute("data", fileinfo.id);
            li.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>" + fileinfo.name + "</span>";
            li.onmouseover = function (e) {
              e.stopPropagation();
              this.classList.add("focused");
            }
            li.onmouseout = function (e) {
              e.stopPropagation();
              this.classList.remove("focused");
            }
            li.onclick = function (e) {
              e.stopPropagation();

              Array.from(exportList.getElementsByTagName("li")).forEach(function (li) {
                li.removeAttribute("selected");
              });
              this.setAttribute("selected", "");

              var exportBtn = document.getElementById("btn-export-to-gdrive");
              exportBtn.setAttribute("activated", "");
              exportBtn.setAttribute("data", this.getAttribute("data"));
            };
            li.ondblclick = function (e) {
              e.stopPropagation();

              // Prevent request duplication
              if (IO.Spinner.exists("spinner-gdrive-export")) return;

              var subtree = this.getElementsByTagName("ul");
              if (subtree.length) {
                this.removeChild(subtree[0]);
              } else {
                _expFiletree(this, access_token, this.getAttribute("data"));
              }
            }
            ul.appendChild(li);
          }
        });

        parent.appendChild(ul);
      } else {
        messageBox("Unable to load files of Google Drive: Error code(" + this.status + ")");
      }
    });
  }
  let _cbReadFile = function () {
    IO.Spinner.hide("spinner-gdrive-import");

    if (this.status == 200) {
      var parsed = parse(this.response);

      editor.setValue(parsed.body.texts);
      editor.focus();
      editor.setCursor(0, 0);

      var selectedTab = Tab.get();
      selectedTab.info = Tab.getInitData();
      selectedTab.info.metadata.type = "gdrive";
      for (var key in parsed.header)
        selectedTab.info.metadata[key] = parsed.header[key];
      selectedTab.info.texts = editor.getValue();
      selectedTab.info.originalTexts = editor.getValue();
      Tab.set(selectedTab.index, selectedTab.info);

      closeAllDialogs();
    } else {
      messageBox("Unable to import google document: Error code(" + this.status + ")");
    }
  }
  let _openCallback = function (access_token) {
    if (chrome.runtime.lastError) {
      messageBox(chrome.runtime.lastError.message); 
      return;
    }
    
    if (access_token) {
      var dialog = document.getElementById("editor-import-gdrive");
      dialog.style.display = "block";

      var importList = document.getElementById("importlist-gdrive");
      importList.removeAllChildren();

      // Create file tree
      var ul = document.createElement("ul");
      ul.className = "filetree";
      var root = document.createElement("li");
      root.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>Root</span>";
      root.onmouseover = function (e) {
        e.stopPropagation();
        this.classList.add("focused");
      }
      root.onmouseout = function (e) {
        e.stopPropagation();
        this.classList.remove("focused");
      }
      ul.appendChild(root);
      importList.appendChild(ul);

      // Navigate subtree
      _impFiletree(root, access_token, "root");

      // Set import button event handler
      var importBtn = document.getElementById("btn-import-from-gdrive");
      importBtn.removeAttribute("activated");
      importBtn.onclick = function (e) {
        if (this.hasAttribute("activated")) {
          if (!IO.checkBeforeLeave()) return;

          IO.Spinner.show(importList, "spinner-gdrive-import");
          _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files/" + this.getAttribute("data") + "/export?mimeType=text/plain", access_token, _cbReadFile);
        }
      }
    }
  }
  let _saveCallback = function (access_token) {
    if (chrome.runtime.lastError) {
      messageBox(chrome.runtime.lastError.message); 
      return;
    }
    
    if (access_token) {
      var dialog = document.getElementById("editor-export-gdrive");
      dialog.style.display = "block";

      var exportList = document.getElementById("exportlist-gdrive");
      exportList.removeAllChildren();

      // Create file tree
      var ul = document.createElement("ul");
      ul.className = "filetree";
      var root = document.createElement("li");
      root.setAttribute("data", "root");
      root.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>Root</span>";
      root.onmouseover = function (e) {
        e.stopPropagation();
        this.classList.add("focused");
      }
      root.onmouseout = function (e) {
        e.stopPropagation();
        this.classList.remove("focused");
      }
      root.onclick = function (e) {
        e.stopPropagation();

        Array.from(exportList.getElementsByTagName("li")).forEach(function (li) {
          li.removeAttribute("selected");
        });
        this.setAttribute("selected", "");

        var exportBtn = document.getElementById("btn-export-to-gdrive");
        exportBtn.setAttribute("activated", "");
        exportBtn.setAttribute("data", "root");
      }
      root.click();
      ul.appendChild(root);
      exportList.appendChild(ul);

      // Navigate subtree
      _expFiletree(root, access_token, "root");

      // Filename
      var saveData = IO.makeSaveData();
      var inputFilename = document.getElementById("input-export-gdrive-filename");
      inputFilename.value = saveData.filename;
      inputFilename.focus();

      // Set save button event handler
      var exportBtn = document.getElementById("btn-export-to-gdrive");
      exportBtn.onclick = function (e) {
        if (this.hasAttribute("activated")) {
          IO.Spinner.show(exportList, "spinner-gdrive-export");

          // Sending data
          var data = "--mdeditor_create_file\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n";
          data += "{ \"name\": \"" + inputFilename.value + "\", \"mimeType\": \"application/vnd.google-apps.document\", \"parents\": [\"" + this.getAttribute("data") + "\"] }\r\n\r\n";
          data += "--mdeditor_create_file\r\nContent-Type: text/plain\r\n\r\n";
          data += saveData.texts + "\r\n--mdeditor_create_file\r\n";

          var xhr = new XMLHttpRequest();
          xhr.open("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
          xhr.setRequestHeader("Authorization", "Bearer " + access_token);
          xhr.setRequestHeader("Content-Type", "multipart/related; boundary=mdeditor_create_file");
          xhr.onload = function () {
            IO.Spinner.hide("spinner-gdrive-export");

            if (this.status == 200) {
              messageBox("Successfully saved.");

              var selectedTab = Tab.get();
              selectedTab.info.metadata.type = "gdrive";
              selectedTab.info.texts = editor.getValue();
              selectedTab.info.originalTexts = editor.getValue();
              selectedTab.info.editor.scrollPos = editor.getScrollInfo();
              selectedTab.info.editor.cursor = editor.getCursor();
              selectedTab.info.viewer.scrollPos = document.getElementById("viewer").scrollTop;
              Tab.set(selectedTab.index, selectedTab.info);

              closeAllDialogs();
            } else {
              messageBox("Unable to save google document: Error code(" + this.status + ")");
            }
          }
          xhr.send(data);
        }
      }
    }
  }

  return {
    open: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          callback: _openCallback
        }
        messageBox("Connecting to Google Drive...");
        _getAuthToken(options);
      } else {
        messageBox("There is no Internet connection.");
      }
    },
    save: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          callback: _saveCallback
        }
        messageBox("Connecting to Google Drive...");
        _getAuthToken(options);
      } else {
        messageBox("There is no Internet connection.");
      }
    }
  }
})();