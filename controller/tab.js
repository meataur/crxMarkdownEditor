document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("select-metadata-type").onchange = function (e) {
    var keywords = {
      local: "local",
      github: "github",
      google: "gdrive"
    }
    var iconId = "icon-file";
    for (var k in keywords) {
      if (this.value.toLowerCase().contains(k)) {
        iconId = "icon-" + keywords[k];
        break;
      }
    }
    var selectedTab = Tab.get();
    selectedTab.tab.getElementsByClassName("doc-type")[0].innerHTML = "<svg><use xlink:href=\"icons.svg#" + iconId + "\"></use></svg>";
  }

  document.getElementById("input-metadata-title").onchange = function (e) {
    var selectedTab = Tab.get();
    selectedTab.tab.getElementsByClassName("doc-title")[0].innerHTML = this.value;
    selectedTab.tab.title = this.value;
    document.title = manifestData.name + " - " + this.value;

    if (editor)
      preview(this.value, editor.getValue());
  }

  document.getElementById("refresh-datetime").onclick = function () {
    document.getElementById("input-metadata-date").value = Util.curtime();
  }
});

let Metadata = {
  getMetadataFromPanel: function () {
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
    metadata.comment = document.getElementById("input-metadata-comment").value;

    // Get custom key-values
    for (var i = 1; i <= 3; i++) {
      var customKey = document.getElementById("input-metadata-reserved-key" + i).value;
      var customValue = document.getElementById("input-metadata-reserved-value" + i).value;
      if (customKey.length)
        metadata[customKey] = customValue;
    }

    return metadata;
  },
  setMetadataToPanel: function (metadata) {
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
    document.getElementById("input-metadata-comment").value = metadata.comment;

    // Set custom key-values
    var generalKeys = ["type", "id", "layout", "title", "date", "category", "tags", "comment"];
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

let Tab = (function () {
  const MAXTABS = 10;
  const TABWIDTH = 200;

  let _data = [];

  let _isNewTabAdded = false;
  let _prevSelectedIdx = 0;
  let _dragSrcTab = null;
  let _dragImg = null;

  let _onTabSelected = function (e) {
    if (this.hasAttribute("selected"))
      return;

    // Save editing environment (if currently selected tab exists)
    var selectedTab = Tab.get();
    if (selectedTab) {
      var i = selectedTab.index;
      _data[i].selected = false;
      _data[i].texts = editor.getValue();
      _data[i].editor.scrollbar = editor.getScrollInfo();
      _data[i].editor.cursor = editor.getCursor();
      _data[i].viewer.scrollPos = document.getElementById("viewer").scrollTop;

      var metadata = Metadata.getMetadataFromPanel();
      for (var key in metadata) {
        _data[i].metadata[key] = metadata[key];
      }

      // Mark currently selected tab as previous one
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

      // Set metadata to each panel elements
      Metadata.setMetadataToPanel(_data[i].metadata);

      // Manually trigger onchange events
      document.getElementById("select-metadata-type").onchange();
      document.getElementById("input-metadata-title").onchange();

      // Activate tab-close button
      var divClose = document.createElement("div");
      divClose.className = "tab-close";
      divClose.title = "Close tab";
      divClose.innerHTML = "<svg><use xlink:href=\"icons.svg#icon-tab-close\"></use></svg>";
      divClose.onclick = Tab.close;
      selectedTab.tab.appendChild(divClose);
    }

    // Release tab creation flag
    _isNewTabAdded = false;
  }

  let _getDocTypeIconId = function (type) {
    if (type.length)
      return "icon-" + type;
    return "icon-file"
  }

  return {
    getInitData: function () {
      return {
        selected: true,
        metadata: {
          type: "",
          id: "",
          layout: "",
          title: "Untitled Document",
          date: "",
          category: "",
          tags: "",
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
    },
    get: function (idx) {
      var tabs = document.getElementsByClassName("tab");
      if (idx == null) {
        for (var i = 0; i < tabs.length - 1; i++) {
          if (tabs[i].hasAttribute("selected")) // Get currently selected tab
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
      // Save document information
      _data[idx] = info;

      // Set metadata to each panel elements
      Metadata.setMetadataToPanel(info.metadata);

      // Manually trigger onchange events
      document.getElementById("select-metadata-type").onchange();
      document.getElementById("input-metadata-title").onchange();
    },
    count: function () {
      return _data.length;
    },
    create: function (info) {
      var divType = document.createElement("div");
      divType.className = "doc-type";
      divType.innerHTML = "<svg><use xlink:href=\"icons.svg#" + _getDocTypeIconId(info.metadata.type) + "\"></use></svg>";
      var divTitle = document.createElement("div");
      divTitle.className = "doc-title";
      divTitle.innerHTML = info.metadata.title.length ? info.metadata.title : "Untitled Document";

      var li = document.createElement("li");
      li.className = "tab";
      li.style.width = 0;
      li.title = divTitle.innerHTML;
      li.appendChild(divType);
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
      var newDocInfo = Tab.getInitData();
      newDocInfo.metadata.date = Util.curtime();
      var newtab = Tab.create(newDocInfo);
      Tab.add(newtab, newDocInfo);

      _isNewTabAdded = true;
    },
    makeNew: function () {
      if (editor) {
        editor.setValue("");
        editor.focus();
        editor.setCursor(editor.lineCount(), 0);

        var selectedTab = Tab.get();
        if (selectedTab) {
          var newDocInfo = Tab.getInitData();
          newDocInfo.metadata.date = Util.curtime();
          Tab.set(selectedTab.index, newDocInfo);
        }
      }
    },
    close: function () {
      // Not to ask if confirmed to close the tab if the previous work is empty
      if (!IO.checkBeforeLeave()) return;

      var tabs = document.getElementsByClassName("tab");
      var nTabs = tabs.length - 1;
      if (nTabs == 1) {
        Tab.makeNew();
        return;
      } else if (nTabs == MAXTABS) {
        setTimeout(function () {
          document.getElementById("create-tab").style.display = "block";
        }, 300);
      }

      var selectedTab = Tab.get();
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

        document.getElementById("tabs").removeChild(selectedTab.tab);
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
      var newWidth = (bodyWidth - menuWidth - addTabBtnWidth - 60) / (tabs.length - 1);
      if (newWidth > TABWIDTH) newWidth = TABWIDTH;
      Array.from(tabs).forEach(function (tab) {
        if (tab.id !== "create-tab")
          tab.style.width = newWidth + "px";
      });
    }
  }
})();