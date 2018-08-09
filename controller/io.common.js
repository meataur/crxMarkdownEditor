let debug = true;

let IO = {
  checkBeforeLeave: function () {
    var selectedTab = Tab.get();
    var parsed = parse(editor.getValue());
    if (selectedTab.info.originalTexts !== editor.getValue() && parsed.body.texts.length)
      return confirm("Changes you made may not be saved.\nAre you sure to open another document?")
    return true;
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
