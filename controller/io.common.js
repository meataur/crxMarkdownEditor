let IO = {
  checkBeforeLeave: function () {
    var selectedTab = Tab.get();
    var parsed = Parser.parse(editor.getValue());
    if (selectedTab.info.originalTexts !== editor.getValue() && parsed.body.texts.length)
      return confirm("Changes you made may not be saved.\nAre you sure to open another document?");
    return true;
  },
  filename: function () {
    var metadata = Dialog.Metadata.getData();
    var docTitle = metadata.title.length ? metadata.title : "Untitled Document";
    var docDate = metadata.date.length ? metadata.date : Util.curtime();
    return [docDate.split(" ")[0], docTitle.replaceAll(" ", "-").toLowerCase()].join("-");
  },
  makeSaveData: function () {
    var data = {
      filename: "",
      metadata: {},
      texts: ""
    }

    data.metadata = Dialog.Metadata.getData();
    data.texts += "---\n";

    // Sort keys
    var keys = [];
    for (var k in data.metadata)
      keys[keys.length] = k;
    keys.sort();

    // Make metadata string to append
    var docDate = "";
    var docTitle = "";
    keys.forEach(function (k) {
      if (k == "type") {
        // Do nothing
      } else if (k == "title") {
        docTitle = data.metadata[k].length ? data.metadata[k] : "Untitled Document";
        data.texts += k + ": " + docTitle + "\n";
        docTitle = docTitle.replaceAll(" ", "-").toLowerCase();
      } else if (k == "date") {
        docDate = data.metadata[k].length ? data.metadata[k] : Util.curtime();
        data.texts += k + ": " + docDate + "\n";
        docDate = docDate.split(" ")[0];
      } else {
        if (data.metadata[k].length)
          data.texts += k + ": " + data.metadata[k] + "\n";
      }
    });
    data.texts += "---\n\n";
    data.texts += editor.getValue();
    data.filename = [docDate, docTitle].join("-") + ".md";

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
