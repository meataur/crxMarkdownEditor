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
        new MessageBox("Unable to load files of Google Drive: Error code(" + this.status + ")").show();
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
        new MessageBox("Unable to load files of Google Drive: Error code(" + this.status + ")").show();
      }
    });
  }
  let _cbReadFile = function () {
    IO.Spinner.hide("spinner-gdrive-import");
    if (Config.debug) {
      console.log(this.status);
      console.log(this.response);
    }

    if (this.status == 200) {
      var parsed = Parser.parse(this.response);

      viewer.scrollTop = 0;
      editor.setValue(parsed.body.texts);
      editor.focus();
      editor.setCursor(0, 0);

      var importList = document.getElementById("importlist-gdrive");
      var filelist = importList.getElementsByTagName("li");
      var savename = "unknown"
      for (var i = 0; i < filelist.length; i++) {
        if (filelist[i].hasAttribute("selected")) {
          savename = filelist[i].innerText;
          break;
        }
      }

      var selectedTab = Tab.get();
      selectedTab.info = Tab.getInitData();
      selectedTab.info.filename = savename;
      if (parsed) {
        for (var key in parsed.header)
          selectedTab.info.metadata[key] = parsed.header[key];
      }
      selectedTab.info.metadata.type = "gdrive";
      selectedTab.info.metadata.id = document.getElementById("btn-import-from-gdrive").getAttribute("data");
      selectedTab.info.hash = IO.filehash(selectedTab.info.metadata, editor.getValue());
      selectedTab.info.texts = editor.getValue();

      // Update tab info
      Tab.set(selectedTab.index, selectedTab.info);

      // Set metadata to each panel elements
      Dialog.Metadata.setData(selectedTab.info.metadata);

      // Manually trigger onchange events
      document.getElementById("input-metadata-title").setAttribute("placeholder", selectedTab.info.filename);
      document.getElementById("input-metadata-title").dispatchEvent(new Event("change"));
      document.getElementById("select-metadata-type").dispatchEvent(new Event("change"));

      Dialog.closeAll();
    } else {
      new MessageBox("Unable to import google document: Error code(" + this.status + ")").show();
    }
  }
  let _openCallback = function (access_token) {
    if (chrome.runtime.lastError) {
      new MessageBox(chrome.runtime.lastError.message).show();
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
      new MessageBox(chrome.runtime.lastError.message).show();
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
      inputFilename.setAttribute("placeholder", saveData.filename);
      inputFilename.focus();

      // Set save button event handler
      var exportBtn = document.getElementById("btn-export-to-gdrive");
      exportBtn.onclick = function (e) {
        if (this.hasAttribute("activated")) {
          IO.Spinner.show(exportList, "spinner-gdrive-export");

          // Save name
          var savename = inputFilename.value;
          if (!savename.length)
            savename = inputFilename.getAttribute("placeholder");

          // Directory path to save file
          var parentId = this.getAttribute("data");

          // Check if the file exists
          _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files/" + saveData.metadata.id + "?fields=*", access_token, function () {
            if (Config.debug) {
              console.log(this.status);
              console.log(this.response);
            }

            if (this.status == 200) {
              if (confirm("The file already exists.\nDo you want to change it?")) {
                // The existing file information
                var fileinfo = JSON.parse(this.response);

                var dataToSend = "--mdeditor_upload_file\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n";
                dataToSend += JSON.stringify({
                  name: savename,
                  mimeType: "application/vnd.google-apps.document"
                }) + "\r\n\r\n";
                dataToSend += "--mdeditor_upload_file\r\nContent-Type: text/plain\r\n\r\n";
                dataToSend += saveData.texts + "\r\n--mdeditor_upload_file\r\n";

                var xhr = new XMLHttpRequest();
                xhr.open("PATCH", "https://www.googleapis.com/upload/drive/v3/files/" + fileinfo.id + "?uploadType=multipart&addParents=" + parentId + "&removeParents=" + fileinfo.parents[0]);
                xhr.setRequestHeader("Authorization", "Bearer " + access_token);
                xhr.setRequestHeader("Content-Type", "multipart/related; boundary=mdeditor_upload_file");
                xhr.onload = function () {
                  IO.Spinner.hide("spinner-gdrive-export");
                  if (Config.debug) {
                    console.log(this.status);
                    console.log(this.response);
                  }

                  if (this.status == 200) {
                    new MessageBox("Successfully updated.").show();

                    var selectedTab = Tab.get();
                    selectedTab.info.filename = JSON.parse(this.response).name;
                    for (var key in saveData.metadata) {
                      selectedTab.info.metadata[key] = saveData.metadata[key];
                    }
                    selectedTab.info.metadata.type = "gdrive";
                    selectedTab.info.metadata.id = JSON.parse(this.response).id;
                    selectedTab.info.hash = IO.filehash(selectedTab.info.metadata, editor.getValue());
                    selectedTab.info.texts = editor.getValue();
                    selectedTab.info.editor.scrollPos = editor.getScrollInfo();
                    selectedTab.info.editor.cursor = editor.getCursor();
                    selectedTab.info.viewer.scrollPos = viewer.scrollTop;

                    // Update tab info
                    Tab.set(selectedTab.index, selectedTab.info);

                    // Set metadata to each panel elements
                    Dialog.Metadata.setData(selectedTab.info.metadata);

                    // Manually trigger onchange events
                    document.getElementById("input-metadata-title").setAttribute("placeholder", selectedTab.info.filename);
                    document.getElementById("input-metadata-title").dispatchEvent(new Event("change"));
                    document.getElementById("select-metadata-type").dispatchEvent(new Event("change"));

                    Dialog.closeAll();
                  } else {
                    new MessageBox("Unable to update the existing google document: Error code(" + this.status + ")").show();
                  }
                }
                xhr.send(dataToSend);
              }
            } else if (this.status == 404) {
              var dataToSend = "--mdeditor_upload_file\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n";
              dataToSend += JSON.stringify({
                name: savename,
                mimeType: "application/vnd.google-apps.document",
                parents: [parentId.toString()]
              }) + "\r\n\r\n";
              dataToSend += "--mdeditor_upload_file\r\nContent-Type: text/plain\r\n\r\n";
              dataToSend += saveData.texts + "\r\n--mdeditor_upload_file\r\n";

              var xhr = new XMLHttpRequest();
              xhr.open("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
              xhr.setRequestHeader("Authorization", "Bearer " + access_token);
              xhr.setRequestHeader("Content-Type", "multipart/related; boundary=mdeditor_upload_file");
              xhr.onload = function () {
                IO.Spinner.hide("spinner-gdrive-export");
                if (Config.debug) {
                  console.log(this.status);
                  console.log(this.response);
                }

                if (this.status == 200) {
                  new MessageBox("Successfully saved.").show();

                  var selectedTab = Tab.get();
                  selectedTab.info.filename = JSON.parse(this.response).name;
                  for (var key in saveData.metadata) {
                    selectedTab.info.metadata[key] = saveData.metadata[key];
                  }
                  selectedTab.info.metadata.type = "gdrive";
                  selectedTab.info.metadata.id = JSON.parse(this.response).id;
                  selectedTab.info.hash = IO.filehash(selectedTab.info.metadata, editor.getValue());
                  selectedTab.info.texts = editor.getValue();
                  selectedTab.info.editor.scrollPos = editor.getScrollInfo();
                  selectedTab.info.editor.cursor = editor.getCursor();
                  selectedTab.info.viewer.scrollPos = viewer.scrollTop;

                  // Update tab info
                  Tab.set(selectedTab.index, selectedTab.info);

                  // Set metadata to each panel elements
                  Dialog.Metadata.setData(selectedTab.info.metadata);

                  // Manually trigger onchange events
                  document.getElementById("input-metadata-title").setAttribute("placeholder", selectedTab.info.filename);
                  document.getElementById("input-metadata-title").dispatchEvent(new Event("change"));
                  document.getElementById("select-metadata-type").dispatchEvent(new Event("change"));

                  Dialog.closeAll();
                } else {
                  new MessageBox("Unable to save google document: Error code(" + this.status + ")").show();
                }
              }
              xhr.send(dataToSend);
            }
          });
        }
      }
    }
  }

  return {
    authchk: function (callback) {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          callback: callback
        }
        _getAuthToken(options);
      }
    },
    auth: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          callback: function () {
            // TODO: 
          }
        }
        new MessageBox("Connecting to Google Drive...").show();
        _getAuthToken(options);
      } else {
        new MessageBox("There is no Internet connection.").show();
      }
    },
    open: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          callback: _openCallback
        }
        new MessageBox("Connecting to Google Drive...").show();
        _getAuthToken(options);
      } else {
        new MessageBox("There is no Internet connection.").show();
      }
    },
    save: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          callback: _saveCallback
        }
        new MessageBox("Connecting to Google Drive...").show();
        _getAuthToken(options);
      } else {
        new MessageBox("There is no Internet connection.").show();
      }
    }
  }
})();