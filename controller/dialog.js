document.addEventListener("DOMContentLoaded", function () {
  // Prevent event propagation on dialogs
  Array.from(document.getElementsByClassName("dlg")).forEach(function (dialog) {
    dialog.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });
  });



  /**
   * Dialog.Metadata controls
   */
  document.getElementById("select-metadata-type").onchange = function (e) {
    var keywords = {
      local: "local",
      github: "github",
      google: "gdrive"
    }
    var iconId = "file";
    for (var k in keywords) {
      if (this.value.toLowerCase().contains(k)) {
        iconId = keywords[k];
        break;
      }
    }

    var selectedTab = Tab.get();
    selectedTab.info.type = (iconId == "file") ? "" : iconId;
    selectedTab.tab.getElementsByClassName("doc-type")[0].innerHTML = "<svg><use xlink:href=\"icons.svg#icon-" + iconId + "\"></use></svg>";
  }
  document.getElementById("input-metadata-title").onchange = function (e) {
    if (!this.value.length)
      this.value = "Untitled Document";

    var selectedTab = Tab.get();
    selectedTab.tab.getElementsByClassName("doc-title")[0].innerHTML = this.value;
    selectedTab.tab.title = "[" + selectedTab.info.date + "] " + this.value;
    selectedTab.info.title = this.value;
    document.title = manifestData.name + " - " + this.value;

    preview(this.value, editor.getValue());
  }
  document.getElementById("input-metadata-date").onchange = function (e) {
    var selectedTab = Tab.get();
    selectedTab.tab.title = "[" + this.value + "] " + selectedTab.info.title;
    selectedTab.info.date = this.value;
  }
  document.getElementById("refresh-datetime").onclick = function () {
    var curtime = Util.curtime();
    document.getElementById("input-metadata-date").value = curtime;

    var selectedTab = Tab.get();
    selectedTab.info.date = curtime;
  }



  /**
   * Dialog.Settings.Editor controls
   */
  document.getElementById("editor-settings-theme").onchange = function () {
    var selector = document.getElementById("editor-settings-theme");
    var theme = selector.options[selector.selectedIndex].textContent;
    editor.setOption("theme", theme);
    Settings.save("editor");
  }
  document.getElementById("editor-settings-fontsize").onchange = function () {
    var selector = document.getElementById("editor-settings-fontsize");
    var fontsize = selector.options[selector.selectedIndex].textContent;
    var editorObj = document.getElementsByClassName('CodeMirror')[0];
    editorObj.style["font-size"] = fontsize + "px";
    editor.refresh();
    Settings.save("editor");
  }
  document.getElementById("editor-settings-scrollsync").onclick = function () {
    Settings.save("editor");
  }
  document.getElementById("attachment-settings-location").onchange = function () {
    this.value = this.value.replace(/{{site.baseurl}}|{{ site.baseurl}}|{{site.baseurl }}/gi, "{{ site.baseurl }}").replace(/\\+$|\/+$/, '');
    Settings.save("attachment");
  }
  document.getElementById("attachment-settings-types").onkeyup = function (e) {
    try {
      JSON.parse(this.value);
      this.style["background"] = "#383838";
      Settings.save("attachment");
    } catch (e) {
      this.style["background"] = "#aa2a2a";
    }
  }
  document.getElementById("attachment-settings-types").onchange = function () {
    try {
      var parsed = JSON.parse(this.value);
      this.value = JSON.stringify(parsed, function (k, v) {
        if (v instanceof Array)
          return JSON.stringify(v);
        return v;
      }, 2).replace(/"\[/g, '[').replace(/\]"/g, ']').replace(/\\"/g, '"').replace(/""/g, '"').replace(/","/g, '", "');
      Settings.save("attachment");
    } catch (e) {
    }
  }
  document.querySelectorAll("input[name=\"hashfunc\"]").forEach(function (input) {
    input.onclick = function () {
      Settings.save("attachment");
    }
  });



  /**
   * Dialog.Settings.Viewer controls
   */
  document.getElementById("viewer-settings-codestyle").onchange = function () {
    document.getElementById("viewer-style-codeblock").href = "lib/highlight-9.12.0/styles/" + this.value + ".css";

    var selectedTab = Tab.get();
    if (selectedTab) {
      preview(selectedTab.info.metadata.title, editor.getValue());
    }
    Settings.save("viewer");
  }
  document.getElementById("viewer-settings-baseurl").onchange = function () {
    this.value = this.value.replace(/\\+$|\/+$/, '');
    Settings.save("viewer");
  }
  document.getElementById("viewer-settings-scrollsync").onclick = function () {
    Settings.save("viewer");
  }
});



/**
 * Dialog
 */

let Dialog = {
  closeAll: function () {
    Array.from(document.getElementsByClassName("dlg")).forEach(function (dlg) {
      dlg.style.display = "none";
    });
  },
  Metadata: (function () {
    return {
      open: function () {
        var div = document.getElementById("editor-doc-metadata");
        div.style.display = "block";
        document.getElementById("input-metadata-layout").focus();
      },
      getData: function () {
        var metadata = {
          type: ""
        }
        var keywords = {
          local: "local",
          github: "github",
          google: "gdrive"
        }
        for (var k in keywords) {
          if (document.getElementById("select-metadata-type").value.toLowerCase().contains(k)) {
            metadata.type = keywords[k];
            break;
          }
        }
        metadata.id = document.getElementById("input-metadata-id").value;
        metadata.layout = document.getElementById("input-metadata-layout").value;
        metadata.title = document.getElementById("input-metadata-title").value;
        metadata.date = document.getElementById("input-metadata-date").value;
        metadata.category = document.getElementById("input-metadata-category").value;
        metadata.tags = document.getElementById("input-metadata-tags").value;
        metadata.description = document.getElementById("input-metadata-description").value;

        // Get custom key-values
        for (var i = 1; i <= 3; i++) {
          var customKey = document.getElementById("input-metadata-reserved-key" + i).value;
          var customValue = document.getElementById("input-metadata-reserved-value" + i).value;
          if (customKey.length)
            metadata[customKey] = customValue;
        }

        return metadata;
      },
      setData: function (metadata) {
        document.getElementById("select-metadata-type").value = "Not specified";
        if (metadata.type && metadata.type.length) {
          var docTypes = {
            local: "Local file",
            github: "Github markdown page",
            gdrive: "Google document"
          }
          document.getElementById("select-metadata-type").value = docTypes[metadata.type];
        }

        document.getElementById("input-metadata-id").value = metadata.id;
        document.getElementById("input-metadata-layout").value = metadata.layout;
        document.getElementById("input-metadata-title").value = metadata.title;
        document.getElementById("input-metadata-date").value = metadata.date;
        document.getElementById("input-metadata-category").value = metadata.category;
        document.getElementById("input-metadata-tags").value = metadata.tags;
        document.getElementById("input-metadata-description").value = metadata.description;

        // Set custom key-values
        var generalKeys = ["type", "id", "layout", "title", "date", "category", "tags", "description"];
        for (var i = 1; i <= 3; i++) {
          document.getElementById("input-metadata-reserved-key" + i).value = "";
          document.getElementById("input-metadata-reserved-value" + i).value = "";
        }
        var cnt = 0;
        for (var k in metadata) {
          if (!generalKeys.includes(k) && cnt < 3) {
            cnt += 1;
            document.getElementById("input-metadata-reserved-key" + cnt).value = k;
            document.getElementById("input-metadata-reserved-value" + cnt).value = metadata[k];
          }
        }
      }
    }
  })(),
  Settings: {
    Editor: (function () {
      return {
        open: function () {
          var div = document.getElementById("editor-settings");
          div.style.display = "block";
          document.getElementById("editor-settings-theme").focus();
        }
      }
    })(),
    Viewer: (function () {
      return {
        open: function () {
          var div = document.getElementById("viewer-settings");
          div.style.display = "block";
          document.getElementById("viewer-settings-baseurl").focus();
        }
      }
    })()
  }
}
