let Tab = (function () {
  const MAXTABS = 8;

  let _data = [];

  let _isNewTabAdded = false;
  let _prevSelectedIdx = 0;
  let _dragSrcTab = null;
  let _dragImg = null;

  let _onTabSelected = function (e) {
    if (this.hasAttribute("selected"))
      return;

    // Save editing environment if there exists currently selected tab
    var selectedTab = Tab.get();
    if (selectedTab) {
      var i = selectedTab.index;
      _data[i].selected = false;
      _data[i].texts = editor.getValue();
      _data[i].editor.scrollbar = editor.getScrollInfo();
      _data[i].editor.cursor = editor.getCursor();
      _data[i].viewer.scrollPos = document.getElementById("viewer").scrollTop;
      _prevSelectedIdx = i;

      // Remove selected attribute
      selectedTab.tab.removeAttribute("selected");

      // Remove tab-close button
      selectedTab.tab.removeChild(selectedTab.tab.getElementsByClassName("tab-close")[0]);
    }

    // Load selected document texts
    this.setAttribute("selected", "");
    selectedTab = Tab.get();
    if (selectedTab) {
      var i = selectedTab.index;
      _data[i].selected = true;

      // Load editing environment
      editor.setValue(_data[i].texts);
      editor.scrollTo(_data[i].editor.scrollPos.left, _data[i].editor.scrollPos.top);
      document.getElementById("viewer").scrollTop = _data[i].viewer.scrollPos;
      editor.focus();
      editor.setCursor(_data[i].editor.cursor.line, _data[i].editor.cursor.ch);

      // Set browser tab title
      document.title = manifestData.name + " - " + _data[i].metadata.title;

      // Activate tab-close button
      var divClose = document.createElement("div");
      divClose.className = "tab-close";
      divClose.title = "Close tab";
      divClose.innerHTML = "<svg><use xlink:href=\"icons.svg#icon-tab-close\"></use></svg>";
      divClose.onclick = Tab.close;

      // Attach tab-close button to each tab
      selectedTab.tab.appendChild(divClose);
    }

    // Release tab creation flag
    _isNewTabAdded = false;
  }

  return {
    get: function (idx) {
      var tabs = document.getElementsByClassName("tab");
      if (idx == null) {
        for (var i = 0; i < tabs.length - 1; i++) {
          if (tabs[i].hasAttribute("selected"))
            return {
              index: i,
              info: _data[i],
              tab: tabs[i]
            };
        }
        return null;
      } else {
        return {
          index: idx,
          info: _data[idx],
          tab: tabs[i]
        }
      }
    },
    set: function (idx, info) {
      _data[idx] = info;

      // Update tab label
      var tabs = document.getElementsByClassName("tab");
      tabs[idx].getElementsByClassName("doc-title")[0].innerHTML = info.metadata.title;
      tabs[idx].title = "[" + info.metadata.type.toUpperCase() + "] " + info.metadata.title;
    },
    count: function () {
      return _data.length;
    },
    create: function (info) {
      var divTitle = document.createElement("div");
      divTitle.className = "doc-title";
      divTitle.innerHTML = info.metadata.title.length ? info.metadata.title : "Untitled Document";

      var li = document.createElement("li");
      li.className = "tab";
      li.style.width = 0;
      li.title = "[" + info.metadata.type.toUpperCase() + "] " + divTitle.innerHTML;
      li.appendChild(divTitle);
      li.setAttribute("draggable", "true");
      li.addEventListener("dragstart", function (e) {
        e.dataTransfer.effectAllowed = "move";
        _dragSrcTab = e.target;

        // Prepare dragging image by element copy
        _dragImg = _dragSrcTab.cloneNode(true);
        _dragImg.style.display = "none";
        document.body.appendChild(_dragImg);
        e.dataTransfer.setDragImage(_dragImg, 5, 5);
      });
      li.addEventListener("dragover", function (e) {
        // Change mouse cursor on drag
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Select list item
        var dragDstTab = e.target.getAncestorByTagName("li");
        if (dragDstTab) {
          // Swap two list-items
          var srcIdx = Array.prototype.indexOf.call(dragDstTab.parentNode.children, _dragSrcTab);
          var dstIdx = Array.prototype.indexOf.call(dragDstTab.parentNode.children, dragDstTab);
          if (dstIdx < srcIdx) {
            dragDstTab.parentNode.insertBefore(_dragSrcTab, dragDstTab);
            _data[srcIdx] = _data.splice(dstIdx, 1, _data[srcIdx])[0];
          } else if (srcIdx < dstIdx) {
            dragDstTab.parentNode.insertBefore(_dragSrcTab, dragDstTab.nextSibling);
            _data[srcIdx] = _data.splice(dstIdx, 1, _data[srcIdx])[0];
          }
        }
      });
      li.addEventListener("dragend", function (e) {
        _dragImg.parentNode.removeChild(_dragImg);
        _dragSrcTab = null;
      });
      li.addEventListener("mousedown", _onTabSelected);

      return li;
    },
    add: function (tab, info) {
      var ul = document.getElementById("tabs");
      if (ul.children.length >= MAXTABS)
        document.getElementById("create-tab").style.display = "none";

      // Append tab
      ul.insertBefore(tab, ul.children[ul.children.length - 1]);
      _data.push(info);

      if (info.selected)
        tab.mousedown();

      Tab.resize();
    },
    addNew: function () {
      var docInfo = {
        selected: true,
        metadata: {
          type: "",
          id: "",
          layout: "",
          title: "Untitled Document",
          datetime: "",
          category: [],
          tags: [],
          comment: ""
        },
        texts: "",
        originalTexts: "",
        editor: {
          width: -1,
          scrollPos: {
            left: 0,
            top: 0
          },
          cursor: {
            line: 0,
            ch: 0
          }
        },
        viewer: {
          width: -1,
          scrollPos: 0
        }
      }
      var newtab = Tab.create(docInfo);
      Tab.add(newtab, docInfo);
      
      var template = initTextarea();
      var selected = Tab.get();
      _data[selected.index].texts = template;

      _isNewTabAdded = true;
    },
    close: function () {
      // Not to ask if confirmed to close the tab if the previous work is empty
      var selectedTab = Tab.get();
      var parsed = parse(editor.getValue());
      if (_data[selectedTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
        if (!confirm("Changes you made may not be saved.\nAre you sure to close the tab?"))
          return;
      }

      var tabs = document.getElementsByClassName("tab");
      var nTabs = tabs.length - 1;
      if (nTabs == 1) {
        initTextarea();
        return;
      } else if (nTabs == MAXTABS) {
        setTimeout(function() {
          document.getElementById("create-tab").style.display = "block";
        }, 300);
      }

      if (selectedTab) {
        // Move to another tab
        if (selectedTab.index === nTabs - 1) {
          if (_isNewTabAdded) {
            tabs[_prevSelectedIdx].mousedown();
            _isNewTabAdded = false;
          } else {
            tabs[selectedTab.index - 1].mousedown();
          }
        } else {
          tabs[selectedTab.index + 1].mousedown();
        }

        // Remove from document list
        _data.splice(selectedTab.index, 1);

        // Tab removal animation
        selectedTab.tab.innerHTML = "";
        selectedTab.tab.style.padding = 0;
        selectedTab.tab.style.width = 0;
        setTimeout(function () {
          document.getElementById("tabs").removeChild(selectedTab.tab);
          Tab.resize();
        }, 300);
      }
    },
    backup: function () {
      chrome.storage.local.set({
        documents: _data
      });
    },
    resize: function () {
      var bodyWidth = parseInt(window.getComputedStyle(document.body).width);
      var menuWidth = 0;
      Array.from(document.getElementsByClassName("menuitem")).forEach(function (menuItem) {
        menuWidth += parseInt(window.getComputedStyle(menuItem).width);
      });

      var tabs = document.getElementsByClassName("tab");
      var addTabBtn = document.getElementById("create-tab");
      var addTabBtnWidth = parseInt(window.getComputedStyle(addTabBtn).width);
      if (addTabBtn.style.display === "none")
        addTabBtnWidth = 0;
      var newWidth = (bodyWidth - menuWidth - addTabBtnWidth - 80) / (tabs.length - 1);
      if (newWidth > 180) newWidth = 180;
      Array.from(tabs).forEach(function (tab) {
        if (tab.id !== "create-tab")
          tab.style.width = newWidth + "px";
      });
    }
  }
})();
