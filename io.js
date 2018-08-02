var debug = true;

let Spinner = (function () {
  let _create = function (id) {
    var spinner = document.createElement("div");
    spinner.id = id;
    spinner.classList.add("spinner");
    for (var i = 1; i < 9; i++) {
      var circle = document.createElement("div");
      circle.classList.add("circle" + i);
      circle.classList.add("circle");
      spinner.appendChild(circle);
    }
    spinner.setAttribute("start", new Date().getTime());
    return spinner;
  }
  return {
    exists: function (id) {
      var spinner = document.getElementById(id);
      return spinner ? true : false;
    },
    show: function (parent, id) {
      if (!this.exists(id)) { parent.appendChild(_create(id)); }
    },
    hide: function (id) {
      var spinner = document.getElementById(id);
      if (spinner) {
        var start = Number(spinner.getAttribute("start"));
        while (true) {
          if ((new Date().getTime() - start) >= 800) {
            spinner.parentNode.removeChild(spinner);
            break;
          }
        }
      }
    }
  }
})();

let IO = {
  Local: {
    open: function () {
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
      input.addEventListener("change", function (e) {
        var reader = new FileReader();
        reader.onload = function (evt) {
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
    },
    save: function () {
      if (editor) {
        // Parse document text data
        var data = editor.getValue();
        var parsed = parse(data);
        var docDatetime = (parsed.header.date && parsed.header.date.length) ? parsed.header.date : getCurDatetimeString();
        var docTitle = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";
        var filename = docDatetime.split(" ")[0] + "-" + docTitle.replaceAll(" ", "-").toLowerCase() + ".md";

        // Create download link element
        chrome.downloads.download({
          url: URL.createObjectURL(new Blob([data], {
            type: "text/x-markdown"
          })),
          filename: filename,
          conflictAction: "overwrite",
          saveAs: true
        }, function (downloadId) {
          chrome.downloads.onChanged.addListener(function (e) {
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
  },
  GDrive: (function () {
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
      Spinner.show(importList, "spinner-gdrive-import");

      _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files?q='" + fileid + "'+in+parents+and+trashed=false", access_token, function () {
        Spinner.hide("spinner-gdrive-import");

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
                if (Spinner.exists("spinner-gdrive-import")) return;

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

                Spinner.show(importList, "spinner-gdrive-import");
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
      Spinner.show(exportList, "spinner-gdrive-export");

      _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files?q='" + fileid + "'+in+parents+and+trashed=false", access_token, function () {
        Spinner.hide("spinner-gdrive-export");

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
                if (Spinner.exists("spinner-gdrive-export")) return;

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
      Spinner.hide("spinner-gdrive-import");

      if (this.status == 200) {
        var activeTab = getActiveTab();
        var parsed = parse(editor.getValue());
        if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
          if (!confirm("Changes you made may not be saved.\nAre you sure to open another document?"))
            return;
        }

        editor.setValue(this.response);
        editor.focus();
        editor.setCursor(0, 0);

        docs[activeTab.index].texts_original = editor.getValue();

        closeAllDialogs();
      } else {
        messageBox("Unable to import google document: Error code(" + this.status + ")");
      }
    }
    let _openCallback = function (access_token) {
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
            Spinner.show(importList, "spinner-gdrive-import");
            _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files/" + this.getAttribute("data") + "/export?mimeType=text/plain", access_token, _cbReadFile);
          }
        }
      } else {
        messageBox("Unexpected error occured: Empty token.");
      }
    }
    let _saveCallback = function (access_token) {
      if (access_token) {
        var dialog = document.getElementById("editor-export-gdrive");
        dialog.style.display = "block";

        var exportList = document.getElementById("exportlist-gdrive");
        exportList.removeAllChildren();

        // Filename
        var inputFilename = document.getElementById("input-export-gdrive-filename");
        var parsed = parse(editor.getValue());
        var docDatetime = (parsed.header.date && parsed.header.date.length) ? parsed.header.date : getCurDatetimeString();
        var docTitle = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";
        inputFilename.value = docDatetime.split(" ")[0] + "-" + docTitle.replaceAll(" ", "-").toLowerCase() + ".md";
        inputFilename.focus();

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

        // Set save button event handler
        var exportBtn = document.getElementById("btn-export-to-gdrive");
        exportBtn.onclick = function (e) {
          if (this.hasAttribute("activated")) {
            Spinner.show(importList, "spinner-gdrive-export");

            // Sending data
            var data = "--mdeditor_create_file\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n";
            data += "{ \"name\": \"" + inputFilename.value + "\", \"mimeType\": \"application/vnd.google-apps.document\", \"parents\": [\"" + this.getAttribute("data") + "\"] }\r\n\r\n";
            data += "--mdeditor_create_file\r\nContent-Type: text/plain\r\n\r\n";
            data += editor.getValue() + "\r\n--mdeditor_create_file\r\n";

            var xhr = new XMLHttpRequest();
            xhr.open("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
            xhr.setRequestHeader("Authorization", "Bearer " + access_token);
            xhr.setRequestHeader("Content-Type", "multipart/related; boundary=mdeditor_create_file");
            xhr.onload = function () {
              Spinner.hide("spinner-gdrive-export");

              if (this.status == 200) {
                messageBox("Successfully saved.");
                closeAllDialogs();
              } else {
                messageBox("Unable to save google document: Error code(" + this.status + ")");
              }
            }
            xhr.send(data);
          }
        }
      } else {
        messageBox("Unexpected error occured: Empty token.");
      }
    }

    return {
      open: function () {
        if (navigator.onLine) {
          messageBox("Loading files of Google drive...");
          var options = {
            interactive: true,
            callback: _openCallback
          }
          _getAuthToken(options);
        } else {
          messageBox("There is no Internet connection.");
        }
      },
      save: function () {
        if (navigator.onLine) {
          messageBox("Loading directories of Google drive...");
          var options = {
            interactive: true,
            callback: _saveCallback
          }
          _getAuthToken(options);
        } else {
          messageBox("There is no Internet connection.");
        }
      }
    }
  })(),
  Github: (function () {
    let _clientId = 'ac52e15a05c1f05e2a14';
    let _clientSecret = '612056756863407c1241706306ec711c76bb8814';
    if (debug) {
      // _clientId = "fffdcf84e36ddeb9bce4";
      // _clientSecret = "609f288a1df9763979ac258a5db17d19ee8ee49e";
      _clientId = "9c527167998b0e4b7c4f";
      _clientSecret = "fe3bfef28a7e5cd53f69ac494857b1fe19a5d47b";
    }
    let _redirectUri = chrome.identity.getRedirectURL("provider_cb");

    let _getAuthToken = function (options, callback) {
      chrome.identity.launchWebAuthFlow(options, function (redirectUri) {
        if (!redirectUri) return;

        // Upon success the response is appended to redirectUri, e.g.
        // https://{app_id}.chromiumapp.org/provider_cb#access_token={value}&refresh_token={value}
        // or:
        // https://{app_id}.chromiumapp.org/provider_cb#code={value}
        var matches = redirectUri.match(new RegExp(_redirectUri + '[#\?](.*)'));
        if (matches && matches.length > 1) {
          // Parse redirect URL
          var redirectUriParams = {};
          matches[1].split(/&/).forEach(function (pair) {
            var nameval = pair.split(/=/);
            redirectUriParams[nameval[0]] = nameval[1];
          });

          if (redirectUriParams.hasOwnProperty('access_token')) {
            // Work with access token
            callback(redirectUriParams.access_token);
          } else if (redirectUriParams.hasOwnProperty('code')) {
            // Exchange code for access token
            var xhr = new XMLHttpRequest();
            xhr.open('GET',
              'https://github.com/login/oauth/access_token?' +
              'client_id=' + _clientId +
              '&client_secret=' + _clientSecret +
              '&redirect_uri=' + redirectUri +
              '&scope=user,repo' +
              '&code=' + redirectUriParams.code);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.onload = function () {
              if (this.status === 200) {
                var response = JSON.parse(this.responseText);
                if (response.hasOwnProperty('access_token'))
                  callback(response.access_token);
              }
            }
            xhr.send();
          }
        }
      });
    }
    let _xhrWithToken = function (method, url, access_token, callback, data) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
      xhr.onload = callback;
      data ? xhr.send(data) : xhr.send();
    }
    let _getUserInfo = function (access_token, callback) {
      _xhrWithToken("GET", "https://api.github.com/user", access_token, callback);
    }
    let _impFiletree = function (parent, access_token, url) {
      var importList = document.getElementById("importlist-github");
      Spinner.show(importList, "spinner-github-import");

      _xhrWithToken("GET", url, access_token, function () {
        Spinner.hide("spinner-github-import");

        if (this.status == 200) {
          var ul = document.createElement("ul");
          var data = JSON.parse(this.response);
          data.forEach(function (fileinfo) {
            if (fileinfo.type === "dir") {
              var li = document.createElement("li");
              li.setAttribute("data", fileinfo.url);
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
                if (Spinner.exists("spinner-github-import")) return;

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
          data.forEach(function (fileinfo) {
            if (fileinfo.type === "file") {
              var ext = fileinfo.name.split('.').pop().toLowerCase();
              if (ext !== "md" && ext !== "markdown")
                return;

              var li = document.createElement("li");
              li.setAttribute("data", fileinfo.url);
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

                var importList = document.getElementById("importlist-github");
                Array.from(importList.getElementsByTagName("li")).forEach(function (li) {
                  li.removeAttribute("selected");
                });
                this.setAttribute("selected", "");

                var importBtn = document.getElementById("btn-import-from-github");
                importBtn.setAttribute("activated", "");
                importBtn.setAttribute("data", this.getAttribute("data"));
              }
              li.ondblclick = function (e) {
                e.stopPropagation();

                Spinner.show(importList, "spinner-github-import");
                _xhrWithToken("GET", this.getAttribute("data"), access_token, _cbReadFile);
              }
              ul.appendChild(li);
            }
          });
          parent.appendChild(ul);
        }
      });
    }
    let _expFiletree = function (parent, access_token, url) {
      var exportList = document.getElementById("exportlist-github");
      Spinner.show(exportList, "spinner-github-export");

      _xhrWithToken("GET", url, access_token, function () {
        Spinner.hide("spinner-github-export");

        if (this.status == 200) {
          var ul = document.createElement("ul");
          var data = JSON.parse(this.response);
          data.forEach(function (fileinfo) {
            if (fileinfo.type === "dir") {
              var li = document.createElement("li");
              li.setAttribute("data", fileinfo.url);
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

                var exportBtn = document.getElementById("btn-export-to-github");
                exportBtn.setAttribute("activated", "");
                exportBtn.setAttribute("data", this.getAttribute("data"));
              };
              li.ondblclick = function (e) {
                e.stopPropagation();

                // Prevent request duplication
                if (Spinner.exists("spinner-github-export")) return;

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
          messageBox("Unable to load Github file list: Error code(" + this.status + ")");
        }
      });
    }
    let _cbReadFile = function () {
      Spinner.hide(importList, "spinner-github-import");

      if (this.status == 200) {
        var activeTab = getActiveTab();
        var parsed = parse(editor.getValue());
        if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
          if (!confirm("Changes you made may not be saved.\nAre you sure to open another document?"))
            return;
        }

        var data = JSON.parse(this.response);
        if (data.encoding === "base64") {
          editor.setValue(decodeURIComponent(Array.prototype.map.call(atob(data.content), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          }).join('')));
        } else {
          editor.setValue("");
        }
        editor.focus();
        editor.setCursor(0, 0);

        docs[activeTab.index].texts_original = editor.getValue();

        closeAllDialogs();
      } else {
        messageBox("Unable to import from Github: Error code(" + this.status + ")");
      }
    }
    let _openCallback = function (access_token) {
      if (access_token) {
        var importList = document.getElementById("importlist-github");
        Spinner.show(importList, "spinner-github-import");

        _getUserInfo(access_token, function () {
          Spinner.hide("spinner-github-import");

          if (this.status == 200) {
            var user = JSON.parse(this.response);

            var dialog = document.getElementById("editor-import-github");
            dialog.style.display = "block";

            importList.removeAllChildren();

            // Create root node
            var ul = document.createElement("ul");
            ul.className = "filetree";
            var root = document.createElement("li");
            root.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>" + user.login + "</span>";
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

            // Load repositories
            Spinner.show(importList, "spinner-github-import");
            _xhrWithToken("GET", user.repos_url, access_token, function () {
              Spinner.hide("spinner-github-import");

              if (this.status === 200) {
                var reposList = document.createElement("ul");
                var repos = JSON.parse(this.response);
                repos.forEach(function (repo) {
                  var li = document.createElement("li");
                  li.setAttribute("data", repo.name);
                  li.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>" + repo.name + "</span>";
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

                    var subtree = this.getElementsByTagName("ul");
                    if (subtree.length) {
                      this.removeChild(subtree[0]);
                    } else {
                      _impFiletree(this, access_token, repo.url + "/contents");
                    }
                  }
                  reposList.appendChild(li);
                });
                root.appendChild(reposList);
              } else {
                messageBox("Unable to load Github repositories: Error code(" + this.status + ")");
              }
            });

            // Set import button event handler
            var importBtn = document.getElementById("btn-import-from-github");
            importBtn.removeAttribute("activated");
            importBtn.onclick = function (e) {
              if (this.hasAttribute("activated")) {
                Spinner.show(importList, "spinner-github-import");
                _xhrWithToken("GET", this.getAttribute("data"), access_token, _cbReadFile);
              }
            }
          }
        });
      } else {
        messageBox("Unexpected error occured: Empty token.");
      }
    }
    let _saveCallback = function (access_token) {
      if (access_token) {
        var exportList = document.getElementById("exportlist-github");
        Spinner.show(exportList, "spinner-github-export");

        _getUserInfo(access_token, function () {
          Spinner.hide("spinner-github-export");

          if (this.status == 200) {
            var user = JSON.parse(this.response);

            var dialog = document.getElementById("editor-export-github");
            dialog.style.display = "block";

            exportList.removeAllChildren();

            // Filename
            var inputFilename = document.getElementById("input-export-github-filename");
            var parsed = parse(editor.getValue());
            var docDatetime = (parsed.header.date && parsed.header.date.length) ? parsed.header.date : getCurDatetimeString();
            var docTitle = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";
            inputFilename.value = docDatetime.split(" ")[0] + "-" + docTitle.replaceAll(" ", "-").toLowerCase() + ".md";
            inputFilename.focus();

            // Create root node
            var ul = document.createElement("ul");
            ul.className = "filetree";
            var root = document.createElement("li");
            root.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>" + user.login + "</span>";
            root.onmouseover = function (e) {
              e.stopPropagation();
              this.classList.add("focused");
            }
            root.onmouseout = function (e) {
              e.stopPropagation();
              this.classList.remove("focused");
            }
            ul.appendChild(root);
            exportList.appendChild(ul);

            // Load repositories
            Spinner.show(exportList, "spinner-github-export");
            _xhrWithToken("GET", user.repos_url, access_token, function () {
              Spinner.hide("spinner-github-export");

              if (this.status === 200) {
                var reposList = document.createElement("ul");
                var repos = JSON.parse(this.response);
                repos.forEach(function (repo) {
                  var li = document.createElement("li");
                  li.setAttribute("data", repo.name);
                  li.innerHTML = "<svg class=\"fileicon\"><use xlink:href=\"icons.svg#icon-folder\"></use></svg><span>" + repo.name + "</span>";
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

                    var exportBtn = document.getElementById("btn-export-to-github");
                    exportBtn.setAttribute("activated", "");
                    exportBtn.setAttribute("data", this.getAttribute("data"));
                  };
                  li.ondblclick = function (e) {
                    e.stopPropagation();

                    // Prevent request duplication
                    if (Spinner.exists("spinner-github-export")) return;

                    var subtree = this.getElementsByTagName("ul");
                    if (subtree.length) {
                      this.removeChild(subtree[0]);
                    } else {
                      _expFiletree(this, access_token, repo.url + "/contents");
                    }
                  }
                  reposList.appendChild(li);
                });
                root.appendChild(reposList);
              } else {
                messageBox("Unable to load Github repositories: Error code(" + this.status + ")");
              }
            });

            // Set save button event handler
            var exportBtn = document.getElementById("btn-export-to-github");
            exportBtn.onclick = function (e) {
              if (this.hasAttribute("activated")) {
                Spinner.show(exportList, "spinner-github-export");

                var data = {
                  message: "commit from MDEditor",
                  content: btoa(unescape(encodeURIComponent(editor.getValue())))
                }

                // Try to create new file
                var url = new URL(this.getAttribute("data"));
                var requestUrl = url.origin + url.pathname.trimRight("/") + "/" + inputFilename.value;
                _xhrWithToken("GET", requestUrl, access_token, function () {
                  if (this.status == 200) {
                    if (confirm("The file already exists.\nDo you want to overwrite it?")) {
                      data.sha = JSON.parse(this.response).sha;
                      _xhrWithToken("PUT", requestUrl, access_token, function () {
                        Spinner.hide("spinner-github-export");

                        if (this.status == 200) {
                          messageBox("Successfully updated.");
                          closeAllDialogs();
                        } else {
                          messageBox("Failed to update file.");
                        }
                      }, JSON.stringify(data));
                    }
                  } else if (this.status == 404) {
                    _xhrWithToken("PUT", requestUrl, access_token, function () {
                      Spinner.hide("spinner-github-export");

                      if (this.status == 201) {
                        messageBox("Successfully saved.");
                        closeAllDialogs();
                      } else {
                        messageBox("Failed to save file. Error code(201)");
                      }
                    }, JSON.stringify(data));
                  } else {
                    Spinner.hide("spinner-github-export");
                    messageBox("Unexpected error occured: Error code(" + this.status + ")");
                  }
                });
              }
            }
          } else {
            messageBox("Unable to get user information: Error code(" + this.status + ")");
          }
        });
      } else {
        messageBox("Unexpected error occured: Empty token.");
      }
    }

    return {
      open: function () {
        if (navigator.onLine) {
          messageBox("Loading Github repository list...");
          var options = {
            interactive: true,
            url: 'https://github.com/login/oauth/authorize?client_id=' + _clientId +
              '&reponse_type=token&scope=user,repo&access_type=online&redirect_uri=' + encodeURIComponent(_redirectUri)
          }
          _getAuthToken(options, _openCallback);
        } else {
          messageBox("There is no Internet connection.");
        }
      },
      save: function () {
        if (navigator.onLine) {
          messageBox("Loading Github repository list...");
          var options = {
            interactive: true,
            url: 'https://github.com/login/oauth/authorize?client_id=' + _clientId +
              '&reponse_type=token&scope=user,repo&access_type=online&redirect_uri=' + encodeURIComponent(_redirectUri)
          }
          _getAuthToken(options, _saveCallback);
        } else {
          messageBox("There is no Internet connection.");
        }
      }
    }
  })()
}