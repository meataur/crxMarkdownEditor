let IO = {
  checkBeforeLeave: function () {
    if (!editor.getValue().length) return true;
    var selectedTab = Tab.get();
    var curHashValue = IO.filehash(Dialog.Metadata.getData(), editor.getValue());
    if (selectedTab.info.hash !== curHashValue) {
      return confirm("Changes you made may not be saved.\nAre you sure to open another document?");
    }
    return true;
  },
  filename: function () {
    var metadata = Dialog.Metadata.getData();
    var docTitle = metadata.title.length ? metadata.title : "Untitled Document";
    var docDate = metadata.date.length ? metadata.date : Util.curtime();
    return [docDate.split(" ")[0], docTitle.replaceAll(" ", "-").toLowerCase()].join("-");
  },
  filehash: function (metadata, texts) {
    var fulldata = "";

    // Sort keys
    var keys = [];
    for (var k in metadata)
      keys[keys.length] = k;
    keys.sort();

    // Append metadata
    var cnt = 0;
    fulldata += "---\n";
    keys.forEach(function (k) {
      if (k == "type") {
        // Skip
      } else if (k == "id") {
        // Skip
      } else {
        if (metadata[k].length) {
          fulldata += k + ": " + metadata[k] + "\n";
          cnt += 1;
        }
      }
    });
    fulldata += "---\n\n";

    if (cnt == 0) fulldata = "";
    fulldata += texts;

    return Util.Converter.stringToHash(fulldata);
  },
  makeSaveData: function () {
    var data = {
      filename: "",
      metadata: {},
      texts: ""
    }

    data.metadata = Dialog.Metadata.getData();

    // Sort keys
    var keys = [];
    for (var k in data.metadata)
      keys[keys.length] = k;
    keys.sort();

    // Make metadata string to append
    var cnt = 0;
    var docDate = "";
    var docTitle = "";
    data.texts += "---\n";
    keys.forEach(function (k) {
      if (k == "type") {
        // Skip
      } else if (k == "id") {
        // Skip
      } else if (k == "title") {
        if (data.metadata[k].length) {
          data.texts += k + ": " + data.metadata[k] + "\n";
          docTitle = data.metadata[k].replaceAll(" ", "-").toLowerCase();
          cnt += 1;
        }
      } else if (k == "date") {
        if (data.metadata[k].length) {
          data.texts += k + ": " + data.metadata[k] + "\n";
          docDate = data.metadata[k].split(" ")[0];
        } else {
          docDate = Util.curtime().split(" ")[0];
        }
      } else {
        if (data.metadata[k].length) {
          data.texts += k + ": " + data.metadata[k] + "\n";
          cnt += 1;
        }
      }
    });
    data.texts += "---\n\n";

    if (cnt == 0) data.texts = "";
    data.texts += editor.getValue();

    if (docTitle.length) {
      data.filename = [docDate, docTitle].join("-") + ".md";
    } else {
      var placeholder = document.getElementById("input-metadata-title").getAttribute("placeholder");
      data.filename = placeholder;
    }

    return data;
  }
}

IO.Spinner = (function () {
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
      return document.getElementById(id) ? true : false;
    },
    show: function (parent, id) {
      if (!this.exists(id)) {
        parent.appendChild(_create(id));
      }
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
