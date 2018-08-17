document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("editor-settings-theme").onchange = function () {
    if (editor) {
      var selector = document.getElementById("editor-settings-theme");
      var theme = selector.options[selector.selectedIndex].textContent;
      editor.setOption("theme", theme);
    }
  }
  document.getElementById("editor-settings-fontsize").onchange = function () {
    if (editor) {
      var selector = document.getElementById("editor-settings-fontsize");
      var fontsize = selector.options[selector.selectedIndex].textContent;
      var editorObj = document.getElementsByClassName('CodeMirror')[0];
      editorObj.style["font-size"] = fontsize + "px";
      editor.refresh();
    }
  }
  document.getElementById("attachment-settings-types").onkeyup = function (e) {
    try {
      JSON.parse(this.value);
      this.style["background"] = "#383838";
    } catch (e) {
      this.style["background"] = "rgb(238,97,80)";
    }
  }
  document.getElementById("viewer-settings-codestyle").onchange = function () {
    document.getElementById("viewer-style-codeblock").href = "lib/highlight-9.12.0/styles/" + this.value + ".css";
    if (editor) {
      var selectedTab = Tab.get();
      if (selectedTab) {
        preview(selectedTab.info.metadata.title, editor.getValue());
      }
    }
  }
  document.getElementById("jekyll-settings-port").onkeypress = function (e) {
    // Allow only number keys
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
  document.getElementById("btn-reset-settings").onclick = function () {
    if (confirm("All open documents will be closed without saving, and all settings are initialized.\nAre you sure you want to continue?")) {
      Tab.resetData();
      Settings.reset();
      Settings.autoSave = false;
      chrome.runtime.reload();
    }
  }
});

let Settings = (function () {
  let _get = function (key, callback, defaultVal) {
    chrome.storage.local.get(key, function (result) {
      if (result[key]) {
        callback(result[key]);
      } else {
        callback(defaultVal);
      }
    });
  }
  let _set = function (key, value) {
    var data = {}
    data[key] = value;
    chrome.storage.local.set(data);
  }

  return {
    autoSave: true,
    openEditorSettingsPanel: function () {
      var div = document.getElementById("editor-settings");
      div.style.display = "block";
      document.getElementById("editor-settings-theme").focus();
    },
    openViewerSettingsPanel: function () {
      var div = document.getElementById("viewer-settings");
      div.style.display = "block";
      document.getElementById("viewer-settings-baseurl").focus();
    },
    load: function (key) {
      if (key == "editor") {
        // Insert font-size options
        var fontsizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32];
        fontsizes.forEach(function (fontsize) {
          var option = document.createElement("option");
          option.innerHTML = fontsize;
          document.getElementById("editor-settings-fontsize").appendChild(option);
        });

        // Insert theme options
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "lib/codemirror-5.39.0/theme.css");
        xhr.onload = function () {
          var lines = xhr.responseText.match(/[^\r\n]+/g);
          lines.forEach(function (line) {
            var cssPath = line.match(/".*?"/g)[0].replace(/"/gi, "");
            var option = document.createElement("option");
            option.innerHTML = cssPath.replace(/^.*[\\\/]/, "").replace(/\.[^/.]+$/, "");
            document.getElementById("editor-settings-theme").appendChild(option);
          });

          _get(key, function (value) {
            document.getElementById("editor-settings-theme").value = value.theme;
            document.getElementById("editor-settings-fontsize").value = value.fontsize;
            document.getElementById("editor-settings-theme").onchange();
            document.getElementById("editor-settings-fontsize").onchange();
          }, {
            theme: "default",
            fontsize: 13
          });
        }
        xhr.send();
      } else if (key == "attachment") {
        _get("attachment", function (value) {
          document.getElementById("attachment-settings-location").value = value.location;
          document.getElementById("attachment-settings-types").value = JSON.stringify(value.types, function (k, v) {
            if (v instanceof Array)
              return JSON.stringify(v);
            return v;
          }, 2).replace(/"\[/g, '[').replace(/\]"/g, ']').replace(/\\"/g, '"').replace(/""/g, '"').replace(/","/g, '", "');
          document.querySelector("input[value='" + value.hashfunc + "']").checked = true;
        }, {
          location: "{{ site.baseurl }}/assets",
          types: {
            img: ["png", "jpg", "jpeg", "gif", "bmp"],
            pdf: ["pdf"],
            doc: ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "hwp", "txt", "html", "htm"]
          },
          hashfunc: "sha256"
        });
      } else if (key == "viewer") {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "lib/highlight-9.12.0/styles.css");
        xhr.onload = function () {
          var lines = xhr.responseText.match(/[^\r\n]+/g);
          lines.forEach(function (line) {
            var cssPath = line.match(/".*?"/g)[0].replace(/"/gi, "");
            var option = document.createElement("option");
            option.innerHTML = cssPath.replace(/^.*[\\\/]/, "").replace(/\.[^/.]+$/, "");
            document.getElementById("viewer-settings-codestyle").appendChild(option);
          });

          _get(key, function (value) {
            document.getElementById("viewer-settings-codestyle").value = value.style.codeblock;
            document.getElementById("viewer-settings-baseurl").value = value.baseurl;
            document.getElementById("viewer-settings-codestyle").onchange();
          }, {
            style: {
              layout: "default",
              codeblock: "darcula"
            },
            baseurl: "http://localhost:4000"
          });
        }
        xhr.send();
      } else if (key == "jekyll") {
        _get(key, function (value) {
          document.getElementById("jekyll-settings-localpath").value = value.local.path;
          document.getElementById("jekyll-settings-port").value = value.local.port;
        }, {
          local: {
            path: "",
            port: 4000
          }
        });
      } else {
        return false;
      }
      return true;
    },
    save: function (key) {
      if (key == "editor") {
        var editorTheme = document.getElementById("editor-settings-theme");
        var edithrFontsize = document.getElementById("editor-settings-fontsize");
        _set(key, {
          theme: editorTheme.options[editorTheme.selectedIndex].textContent,
          fontsize: edithrFontsize.options[edithrFontsize.selectedIndex].textContent
        });
      } else if (key == "attachment") {
        try {
          var parsed = JSON.parse(document.getElementById("attachment-settings-types").value);
          _set(key, {
            location: document.getElementById("attachment-settings-location").value.replace(/\/+$/, ''),
            types: parsed,
            hashfunc: document.querySelector('input[name="hashing"]:checked').value
          });
        } catch (e) {
          return false;
        }
      } else if (key == "viewer") {
        _set(key, {
          style: {
            layout: "default",
            codeblock: document.getElementById("viewer-settings-codestyle").value
          },
          baseurl: document.getElementById("viewer-settings-baseurl").value
        });
      } else if (key == "jekyll") {
        _set(key, {
          local: {
            path: document.getElementById("jekyll-settings-localpath").value.replace(/\\+$/, ''),
            port: document.getElementById("jekyll-settings-port").value
          }
        });
      } else {
        return false;
      }
      return true;
    },
    loadAll: function () {
      Settings.load("editor");
      Settings.load("attachment");
      Settings.load("viewer");
      Settings.load("jekyll");
    },
    saveAll: function () {
      Settings.save("editor");
      Settings.save("attachment");
      Settings.save("viewer");
      Settings.save("jekyll");
    },
    reset: function () {
      chrome.storage.local.clear();
    }
  }
})();
