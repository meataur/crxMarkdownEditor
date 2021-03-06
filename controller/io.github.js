IO.Github = (function () {
  let _clientId = "ac52e15a05c1f05e2a14";
  let _clientSecret = "612056756863407c1241706306ec711c76bb8814";
  if (Config.debug) {
    if (Config.workathome) {
      _clientId = "fffdcf84e36ddeb9bce4";
      _clientSecret = "609f288a1df9763979ac258a5db17d19ee8ee49e";
    } else {
      _clientId = "9c527167998b0e4b7c4f";
      _clientSecret = "fe3bfef28a7e5cd53f69ac494857b1fe19a5d47b";
    }
  }
  let _redirectUri = chrome.identity.getRedirectURL("provider_cb");

  let _getAuthToken = function (options, callback) {
    chrome.identity.launchWebAuthFlow(options, function (redirectUri) {
      if (chrome.runtime.lastError) {
        new MessageBox(chrome.runtime.lastError.message).show(); 
        return;
      }

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
    IO.Spinner.show(importList, "spinner-github-import");

    _xhrWithToken("GET", url, access_token, function () {
      IO.Spinner.hide("spinner-github-import");

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
              if (IO.Spinner.exists("spinner-github-import")) return;

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

              if (!IO.checkBeforeLeave()) return;

              IO.Spinner.show(importList, "spinner-github-import");
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
    IO.Spinner.show(exportList, "spinner-github-export");

    _xhrWithToken("GET", url, access_token, function () {
      IO.Spinner.hide("spinner-github-export");

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
              if (IO.Spinner.exists("spinner-github-export")) return;

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
        new MessageBox("Unable to load Github file list: Error code(" + this.status + ")").show();
      }
    });
  }
  let _cbReadFile = function () {
    IO.Spinner.hide("spinner-github-import");
    if (Config.debug) {
      console.log(this.status);
      console.log(this.response);
    }

    if (this.status == 200) {
      var parsed = null;
      if (JSON.parse(this.response).encoding === "base64") {
        viewer.scrollTop = 0;
        var textData = decodeURIComponent(Array.prototype.map.call(atob(JSON.parse(this.response).content), function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''));
        parsed = Parser.parse(textData);
        editor.setValue(parsed.body.texts);
      } else {
        editor.setValue("");
      }
      editor.focus();
      editor.setCursor(0, 0);

      var selectedTab = Tab.get();
      selectedTab.info = Tab.getInitData();
      selectedTab.info.filename = JSON.parse(this.response).name;
      if (parsed) {
        for (var key in parsed.header)
          selectedTab.info.metadata[key] = parsed.header[key];
      }
      selectedTab.info.metadata.type = "github";
      selectedTab.info.metadata.id = JSON.parse(this.response).sha;    // Github data has itw own hash value.
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
      new MessageBox("Unable to import from Github: Error code(" + this.status + ")").show();
    }
  }
  let _openCallback = function (access_token) {
    if (access_token) {
      _getUserInfo(access_token, function () {
        if (Config.debug) {
          console.log(this.status);
          console.log(this.response);
        }

        if (this.status == 200) {
          var user = JSON.parse(this.response);

          var dialog = document.getElementById("editor-import-github");
          dialog.style.display = "block";

          var importList = document.getElementById("importlist-github");
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
          IO.Spinner.show(importList, "spinner-github-import");
          _xhrWithToken("GET", user.repos_url, access_token, function () {
            IO.Spinner.hide("spinner-github-import");

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
              new MessageBox("Unable to load Github repositories: Error code(" + this.status + ")").show();
            }
          });

          // Set import button event handler
          var importBtn = document.getElementById("btn-import-from-github");
          importBtn.removeAttribute("activated");
          importBtn.onclick = function (e) {
            if (this.hasAttribute("activated")) {
              if (!IO.checkBeforeLeave()) return;

              IO.Spinner.show(importList, "spinner-github-import");
              _xhrWithToken("GET", this.getAttribute("data"), access_token, _cbReadFile);
            }
          }
        } else {
          new MessageBox("Unable to get user information: Error code(" + this.status + ")").show();
        }
      });
    } else {
      new MessageBox("Unexpected error occured: Empty token.").show();
    }
  }
  let _saveCallback = function (access_token) {
    if (access_token) {
      _getUserInfo(access_token, function () {
        if (Config.debug) {
          console.log(this.status);
          console.log(this.response);
        }

        if (this.status == 200) {
          var user = JSON.parse(this.response);

          var dialog = document.getElementById("editor-export-github");
          dialog.style.display = "block";

          var exportList = document.getElementById("exportlist-github");
          exportList.removeAllChildren();

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
          IO.Spinner.show(exportList, "spinner-github-export");
          _xhrWithToken("GET", user.repos_url, access_token, function () {
            IO.Spinner.hide("spinner-github-export");

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
                  if (IO.Spinner.exists("spinner-github-export")) return;

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
              new MessageBox("Unable to load Github repositories: Error code(" + this.status + ")").show();
            }
          });

          // Filename
          var saveData = IO.makeSaveData();
          var inputFilename = document.getElementById("input-export-github-filename");
          inputFilename.setAttribute("placeholder", saveData.filename);
          inputFilename.focus();

          // Set save button event handler
          var exportBtn = document.getElementById("btn-export-to-github");
          exportBtn.onclick = function (e) {
            if (this.hasAttribute("activated")) {
              IO.Spinner.show(exportList, "spinner-github-export");

              var savename = inputFilename.value;
              if (!savename.length)
                savename = inputFilename.getAttribute("placeholder");

              // Try to create new file
              var url = new URL(this.getAttribute("data"));
              var requestUrl = url.origin + url.pathname.trimRight("/") + "/" + savename;
              _xhrWithToken("GET", requestUrl, access_token, function () {
                if (Config.debug) {
                  console.log(this.status);
                  console.log(this.response);
                }

                if (this.status == 200) {
                  if (confirm("The file already exists.\nDo you want to overwrite it?")) {
                    var dataToSend = {
                      message: "commit from MDEditor",
                      content: btoa(unescape(encodeURIComponent(saveData.texts))),
                      sha: JSON.parse(this.response).sha
                    }
                    _xhrWithToken("PUT", requestUrl, access_token, function () {
                      IO.Spinner.hide("spinner-github-export");
                      if (Config.debug) {
                        console.log(this.status);
                        console.log(this.response);
                      }

                      if (this.status == 200) {
                        new MessageBox("Successfully updated.").show();

                        var selectedTab = Tab.get();
                        selectedTab.info.filename = JSON.parse(this.response).content.name;
                        for (var key in saveData.metadata) {
                          selectedTab.info.metadata[key] = saveData.metadata[key];
                        }
                        selectedTab.info.metadata.type = "github";
                        selectedTab.info.metadata.id = JSON.parse(this.response).content.sha;
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
                        new MessageBox("Failed to update file. Error code(" + this.status + ")").show();
                      }
                    }, JSON.stringify(dataToSend));
                  }
                } else if (this.status == 404) {
                  var dataToSend = {
                    message: "commit from MDEditor",
                    content: btoa(unescape(encodeURIComponent(saveData.texts)))
                  }
                  _xhrWithToken("PUT", requestUrl, access_token, function () {
                    IO.Spinner.hide("spinner-github-export");
                    if (Config.debug) {
                      console.log(this.status);
                      console.log(this.response);
                    }

                    if (this.status == 201) {
                      new MessageBox("Successfully saved.").show();

                      var selectedTab = Tab.get();
                      selectedTab.info.filename = JSON.parse(this.response).content.name;
                      for (var key in saveData.metadata) {
                        selectedTab.info.metadata[key] = saveData.metadata[key];
                      }
                      selectedTab.info.metadata.type = "github";
                      selectedTab.info.metadata.id = JSON.parse(this.response).content.sha;
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
                      new MessageBox("Failed to save file. Error code(" + this.status + ")").show();
                    }
                  }, JSON.stringify(dataToSend));
                } else {
                  IO.Spinner.hide("spinner-github-export");
                  new MessageBox("Unexpected error occured: Error code(" + this.status + ")").show();
                }
              });
            }
          }
        } else {
          new MessageBox("Unable to get user information: Error code(" + this.status + ")").show();
        }
      });
    } else {
      new MessageBox("Unexpected error occured: Empty token.").show();
    }
  }

  return {
    authchk: function (callback) {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          url: ""
        }
        _getAuthToken(options, callback);
      }
    },
    auth: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          url: 'https://github.com/login/oauth/authorize?client_id=' + _clientId +
            '&reponse_type=token&scope=user,repo&access_type=online&redirect_uri=' + encodeURIComponent(_redirectUri)
        }
        new MessageBox("Connecting to Github...").show();
        _getAuthToken(options, function () {
          // TODO: 
        });
      } else {
        new MessageBox("There is no Internet connection.").show();
      }
    },
    open: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          url: 'https://github.com/login/oauth/authorize?client_id=' + _clientId +
            '&reponse_type=token&scope=user,repo&access_type=online&redirect_uri=' + encodeURIComponent(_redirectUri)
        }
        new MessageBox("Connecting to Github...").show();
        _getAuthToken(options, _openCallback);
      } else {
        new MessageBox("There is no Internet connection.").show();
      }
    },
    save: function () {
      if (navigator.onLine) {
        var options = {
          interactive: true,
          url: 'https://github.com/login/oauth/authorize?client_id=' + _clientId +
            '&reponse_type=token&scope=user,repo&access_type=online&redirect_uri=' + encodeURIComponent(_redirectUri)
        }
        new MessageBox("Connecting to Github...").show();
        _getAuthToken(options, _saveCallback);
      } else {
        new MessageBox("There is no Internet connection.").show();
      }
    }
  }
})();