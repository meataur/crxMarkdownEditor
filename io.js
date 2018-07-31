var debug = true;

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

        // Get save name from document meta-data
        var filename = docDatetime.split(" ")[0] + "-" + docTitle.toLowerCase().replaceAll(" ", "-") + ".md";

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
      _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files?q='" + fileid + "'+in+parents+and+trashed=false", access_token, function () {
        if (this.status == 200) {
          var spinner = document.getElementById("spinner-gdrive-import");
          if (spinner) spinner.classList.toggle("fadeout");

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
                if (!spinner.classList.contains("fadeout")) return;

                var subtree = this.getElementsByTagName("ul");
                if (subtree.length) {
                  this.removeChild(subtree[0]);
                } else {
                  spinner.classList.toggle("fadeout");
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

                var importList = document.getElementById("importlist-gdrive");
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

                // Get file content
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "https://www.googleapis.com/drive/v3/files/" + fileinfo.id + "/export?mimeType=text/plain");
                xhr.setRequestHeader("Authorization", "Bearer " + access_token);
                xhr.onload = function () {
                  var activeTab = getActiveTab();
                  var parsed = parse(editor.getValue());
                  if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
                    if (!confirm("Changes you made may not be saved.\nAre you sure to open another document?"))
                      return;
                  }

                  editor.setValue(xhr.response);
                  editor.focus();
                  editor.setCursor(0, 0);

                  docs[activeTab.index].texts_original = editor.getValue();
                }
                xhr.send();

                // Close dialog
                closeAllDialogs();
              }
              ul.appendChild(li);
            }
          });

          parent.appendChild(ul);
        }
      });
    }
    let _expFiletree = function (parent, access_token, fileid) {
      _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files?q='" + fileid + "'+in+parents+and+trashed=false", access_token, function () {
        if (this.status == 200) {
          var spinner = document.getElementById("spinner-gdrive-export");
          if (spinner) spinner.classList.toggle("fadeout");

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

                var exportList = document.getElementById("exportlist-gdrive");
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
                if (!spinner.classList.contains("fadeout")) return;

                var subtree = this.getElementsByTagName("ul");
                if (subtree.length) {
                  this.removeChild(subtree[0]);
                } else {
                  spinner.classList.toggle("fadeout");
                  _expFiletree(this, access_token, this.getAttribute("data"));
                }
              }
              ul.appendChild(li);
            }
          });

          parent.appendChild(ul);
        }
      });
    }
    let _openCallback = function (access_token) {
      if (access_token) {
        var dialog = document.getElementById("editor-import-gdrive");
        dialog.style.display = "block";

        var importList = document.getElementById("importlist-gdrive");
        importList.removeAllChildren();

        // Create spinner
        var spinner = createSpinner("spinner-gdrive-import");
        importList.appendChild(spinner);

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
        _impFiletree(root, access_token, "root");
        importList.appendChild(ul);

        // Set import button event handler
        var importBtn = document.getElementById("btn-import-from-gdrive");
        importBtn.removeAttribute("activated");
        importBtn.onclick = function (e) {
          if (this.hasAttribute("activated")) {
            _xhrWithToken("GET", "https://www.googleapis.com/drive/v3/files/" + this.getAttribute("data") + "/export?mimeType=text/plain", access_token, function () {
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
              }
            });

            // Close dialog
            closeAllDialogs();
          }
        }
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
        var activeTab = getActiveTab();
        if (activeTab) {
          var docDatetime = activeTab.tab.getElementsByClassName("doc-datetime")[0].innerHTML;
          var docTitle = activeTab.tab.getElementsByClassName("doc-title")[0].innerHTML;
          inputFilename.value = docDatetime + "-" + docTitle.replaceAll(" ", "-") + ".md";
        }
        inputFilename.focus();

        // Create spinner
        var spinner = createSpinner("spinner-gdrive-export");
        exportList.appendChild(spinner);

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

          var exportList = document.getElementById("exportlist-gdrive");
          Array.from(exportList.getElementsByTagName("li")).forEach(function (li) {
            li.removeAttribute("selected");
          });
          this.setAttribute("selected", "");

          var exportBtn = document.getElementById("btn-export-to-gdrive");
          exportBtn.setAttribute("activated", "");
          exportBtn.setAttribute("data", "root");
        }
        root.click();
        root.ondblclick = function (e) {
          e.stopPropagation();
        }
        ul.appendChild(root);
        _expFiletree(root, access_token, "root");
        exportList.appendChild(ul);

        // Set save button event handler
        var exportBtn = document.getElementById("btn-export-to-gdrive");
        exportBtn.onclick = function (e) {
          if (this.hasAttribute("activated")) {
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
              messageBox("Successfully saved.");
            }
            xhr.send(data);

            // Close dialog
            closeAllDialogs();
          }
        }
      }
    }

    return {
      open: function () {
        var options = {
          interactive: true,
          callback: _openCallback
        }
        _getAuthToken(options);
      },
      save: function () {
        var options = {
          interactive: true,
          callback: _saveCallback
        }
        _getAuthToken(options);
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
      _xhrWithToken("GET", url, access_token, function () {
        if (this.status == 200) {
          var spinner = document.getElementById("spinner-github-import");
          if (spinner) spinner.classList.toggle("fadeout");

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
                if (!spinner.classList.contains("fadeout")) return;

                var subtree = this.getElementsByTagName("ul");
                if (subtree.length) {
                  this.removeChild(subtree[0]);
                } else {
                  spinner.classList.toggle("fadeout");
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

                // Get file content
                _xhrWithToken("GET", this.getAttribute("data"), access_token, _cbReadFile);

                // Close dialog
                closeAllDialogs();
              }
              ul.appendChild(li);
            }
          });
          parent.appendChild(ul);
        }
      });
    }
    let _expFiletree = function (parent, access_token, url) {
      _xhrWithToken("GET", url, access_token, function () {
        if (this.status == 200) {
          var spinner = document.getElementById("spinner-github-export");
          if (spinner) spinner.classList.toggle("fadeout");

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

                var exportList = document.getElementById("exportlist-github");
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
                if (!spinner.classList.contains("fadeout")) return;

                var subtree = this.getElementsByTagName("ul");
                if (subtree.length) {
                  this.removeChild(subtree[0]);
                } else {
                  spinner.classList.toggle("fadeout");
                  _expFiletree(this, access_token, this.getAttribute("data"));
                }
              }
              ul.appendChild(li);
            }
          });
          parent.appendChild(ul);
        }
      });
    }
    let _cbReadFile = function () {
      if (this.status == 200) {
        var activeTab = getActiveTab();
        var parsed = parse(editor.getValue());
        if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
          if (!confirm("Changes you made may not be saved.\nAre you sure to open another document?"))
            return;
        }

        var data = JSON.parse(this.response);
        console.log(this.response);
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
      }
    }
    let _openCallback = function (access_token) {
      if (access_token) {
        _getUserInfo(access_token, function () {
          if (this.status == 200) {
            var user = JSON.parse(this.response);

            var dialog = document.getElementById("editor-import-github");
            dialog.style.display = "block";

            var importList = document.getElementById("importlist-github");
            importList.removeAllChildren();

            // Create spinner
            var spinner = createSpinner("spinner-github-import");
            importList.appendChild(spinner);

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

            // Repository list
            _xhrWithToken("GET", user.repos_url, access_token, function () {
              if (this.status === 200) {
                var spinner = document.getElementById("spinner-github-import");
                if (spinner) spinner.classList.toggle("fadeout");

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
                      spinner.classList.toggle("fadeout");
                      _impFiletree(this, access_token, repo.url + "/contents");
                    }
                  }
                  reposList.appendChild(li);
                });
                root.appendChild(reposList);
              }
            });

            // Set import button event handler
            var importBtn = document.getElementById("btn-import-from-github");
            importBtn.removeAttribute("activated");
            importBtn.onclick = function (e) {
              if (this.hasAttribute("activated")) {
                _xhrWithToken("GET", this.getAttribute("data"), access_token, _cbReadFile);

                // Close dialog
                closeAllDialogs();
              }
            }
          }
        });
      }
    }
    let _saveCallback = function (access_token) {
      if (access_token) {
        _getUserInfo(access_token, function () {
          if (this.status == 200) {
            var user = JSON.parse(this.response);

            var dialog = document.getElementById("editor-export-github");
            dialog.style.display = "block";

            var exportList = document.getElementById("exportlist-github");
            exportList.removeAllChildren();

            // Filename
            var inputFilename = document.getElementById("input-export-github-filename");
            var activeTab = getActiveTab();
            if (activeTab) {
              var docDatetime = activeTab.tab.getElementsByClassName("doc-datetime")[0].innerHTML;
              var docTitle = activeTab.tab.getElementsByClassName("doc-title")[0].innerHTML;
              inputFilename.value = docDatetime + "-" + docTitle.replaceAll(" ", "-") + ".md";
            }
            inputFilename.focus();

            // Create spinner
            var spinner = createSpinner("spinner-github-export");
            exportList.appendChild(spinner);

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
            root.ondblclick = function (e) {
              e.stopPropagation();
            }
            ul.appendChild(root);
            exportList.appendChild(ul);

            // Repository list
            _xhrWithToken("GET", user.repos_url, access_token, function () {
              if (this.status === 200) {
                var spinner = document.getElementById("spinner-github-export");
                if (spinner) spinner.classList.toggle("fadeout");

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

                    var exportList = document.getElementById("exportlist-github");
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
                    if (!spinner.classList.contains("fadeout")) return;

                    var subtree = this.getElementsByTagName("ul");
                    if (subtree.length) {
                      this.removeChild(subtree[0]);
                    } else {
                      spinner.classList.toggle("fadeout");
                      _expFiletree(this, access_token, repo.url + "/contents");
                    }
                  }
                  reposList.appendChild(li);
                });
                root.appendChild(reposList);
              }
            });

            // Set save button event handler
            var exportBtn = document.getElementById("btn-export-to-github");
            exportBtn.onclick = function (e) {
              if (this.hasAttribute("activated")) {
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
                        if (this.status == 200) {
                          messageBox("Successfully updated.");
                        } else {
                          messageBox("Failed to update file.");
                          console.log(this.response);
                        }
                      }, JSON.stringify(data));
                    }
                  } else if (this.status == 404) {
                    _xhrWithToken("PUT", requestUrl, access_token, function () {
                      if (this.status == 201) {
                        messageBox("Successfully saved.");
                      } else {
                        messageBox("Failed to save file.");
                        console.log(this.response);
                      }
                    }, JSON.stringify(data));
                  } else {
                    messageBox("Unexpected error occured.");
                    console.log(this.response);
                  }
                });

                // Close dialog
                closeAllDialogs();
              }
            }
          }
        });
      }
    }

    return {
      open: function () {
        var options = {
          interactive: true,
          url: 'https://github.com/login/oauth/authorize?client_id=' + _clientId +
            '&reponse_type=token&scope=user,repo&access_type=online&redirect_uri=' + encodeURIComponent(_redirectUri)
        }
        _getAuthToken(options, _openCallback);
      },
      save: function () {
        var options = {
          interactive: true,
          url: 'https://github.com/login/oauth/authorize?client_id=' + _clientId +
            '&reponse_type=token&scope=user,repo&access_type=online&redirect_uri=' + encodeURIComponent(_redirectUri)
        }
        _getAuthToken(options, _saveCallback);
      }
    }
  })()
}