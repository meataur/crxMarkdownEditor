let debug = false;

let IO = {
  checkBeforeLeave: function () {
    var selectedTab = Tab.get();
    var parsed = parse(editor.getValue());
    if (selectedTab.info.originalTexts !== editor.getValue() && parsed.body.texts.length)
      return confirm("Changes you made may not be saved.\nAre you sure to open another document?")
    return true;
  },
  makeSaveData: function () {
    var data = {
      filename: "",
      texts: ""
    }
    var docDatetime = "";
    var docTitle = "";

    if (editor) {
      data.texts += "---\n";
      var metadata = Metadata.getMetadataFromPanel();

      // Sort keys
      var keys = [];
      for (var k in metadata)
        keys[keys.length] = k;
      keys.sort();

      keys.forEach(function (k) {
        if (metadata[k].length) {
          data.texts += k + ": " + metadata[k] + "\n";
          if (k == "title") {
            docTitle = metadata[k].length ? metadata[k] : "Untitled Document";
            docTitle = docTitle.replaceAll(" ", "-").toLowerCase();
          }
        }
        if (k == "date") {
          docDatetime = metadata[k].length ? metadata[k] : Util.curtime();
          docDatetime = docDatetime.split(" ")[0];
        }
      });
      data.texts += "---\n\n";
      data.texts += editor.getValue();
      data.filename = [docDatetime, docTitle].join("-") + ".md";
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