

let Tab = {
  getActive: function () {
    var tabs = document.getElementsByClassName("tab");
    for (var i = 0; i < tabs.length - 1; i++) {
      if (tabs[i].hasAttribute("active"))
        return {
          tab: tabs[i],
          index: i
        };
    }
    return null;
  },
  create: function (docTitle) {
    var divTitle = document.createElement("div");
    divTitle.className = "doc-title";
    divTitle.innerHTML = docTitle;

    var li = document.createElement("li");
    li.className = "tab";
    li.style.width = 0;
    li.title = docTitle;
    li.appendChild(divTitle);
    li.setAttribute("draggable", "true");
    li.addEventListener("dragstart", function (e) {
      e.dataTransfer.effectAllowed = "move";
      srcTab = e.target;

      // Prepare dragging image by element copy
      dragImage = srcTab.cloneNode(true);
      dragImage.style.display = "none";
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 5, 5);
    });
    li.addEventListener("dragover", function (e) {
      // Change mouse cursor on drag
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Select list item
      var dstTab = e.target.getAncestorByTagName("li");
      if (dstTab) {
        // Swap two list-items
        var srcIdx = Array.prototype.indexOf.call(dstTab.parentNode.children, srcTab);
        var dstIdx = Array.prototype.indexOf.call(dstTab.parentNode.children, dstTab);
        if (dstIdx < srcIdx) {
          dstTab.parentNode.insertBefore(srcTab, dstTab);
          docs[srcIdx] = docs.splice(dstIdx, 1, docs[srcIdx])[0];
        } else if (srcIdx < dstIdx) {
          dstTab.parentNode.insertBefore(srcTab, dstTab.nextSibling);
          docs[srcIdx] = docs.splice(dstIdx, 1, docs[srcIdx])[0];
        }
      }
    });
    li.addEventListener("dragend", function (e) {
      dragImage.parentNode.removeChild(dragImage);
      srcTab = null;
    });
    li.addEventListener("mousedown", function (e) {
      if (this.hasAttribute("active"))
        return;

      // Save editing environment if there exists currently active tab
      var activeTab = Tab.getActive();
      if (activeTab) {
        var i = activeTab.index;
        docs[i].texts = editor.getValue();
        docs[i].scrollbar = editor.getScrollInfo();
        docs[i].cursor = editor.getCursor();
        docs[i].viewer_scroll = document.getElementById("viewer").scrollTop;
        docs[i].active = false;
        prevWorkingTabIdx = i;

        // Remove active attribute
        activeTab.tab.removeAttribute("active");

        // Remove tab-close button
        activeTab.tab.removeChild(activeTab.tab.getElementsByClassName("tab-close")[0]);
      }

      // Load selected document texts
      this.setAttribute("active", "");
      activeTab = Tab.getActive();
      if (activeTab) {
        var i = activeTab.index;

        // Load editing environment
        editor.setValue(docs[i].texts);
        editor.scrollTo(docs[i].scrollbar.left, docs[i].scrollbar.top);
        document.getElementById("viewer").scrollTop = docs[i].viewer_scroll;
        editor.focus();
        editor.setCursor(docs[i].cursor.line, docs[i].cursor.ch);

        // Set browser tab title
        document.title = manifestData.name + " - " + activeTab.tab.getElementsByClassName("doc-title")[0].innerHTML;

        // Set active
        docs[i].active = true;

        // Activate tab-close button
        var divClose = document.createElement("div");
        divClose.className = "tab-close";
        divClose.title = "Close tab";
        divClose.innerHTML = "<svg><use xlink:href=\"icons.svg#icon-tab-close\"></use></svg>";
        divClose.onclick = Tab.close;

        // Attach tab-close button to each tab
        activeTab.tab.appendChild(divClose);
      }

      // Save current workspace
      chrome.storage.local.set({
        documents: docs
      });

      // Release tab creation flag
      isNewTabCreated = false;
    });

    return li;
  },
  addNew: function () {
    var ul = document.getElementById("tabs");
    if (ul.children.length >= 8)
      document.getElementById("create-tab").style.display = "none";

    // Create new tab
    var newtab = Tab.create("Untitled Document");
    ul.insertBefore(newtab, ul.children[ul.children.length - 1]);

    // Add empty document to list
    docs.push({
      texts_original: "",
      texts: "",
      scrollbar: {
        left: 0,
        top: 0
      },
      cursor: {
        line: 0,
        ch: 0
      },
      viewer_scroll: 0,
      active: false
    });

    // Adjust tab widths
    Tab.resize();

    // Click newly-created tab
    newtab.mousedown();

    // Set default format
    var template = initTextarea();
    docs[docs.length - 1].texts_original = template;
    docs[docs.length - 1].texts = template;

    // Set tab creation flag
    isNewTabCreated = true;
  },
  close: function () {
    // Not to ask if confirmed to close the tab if the previous work is empty
    var activeTab = Tab.getActive();
    var parsed = parse(editor.getValue());
    if (docs[activeTab.index].texts_original !== editor.getValue() && parsed.body.texts.length) {
      if (!confirm("Changes you made may not be saved.\nAre you sure to close the tab?"))
        return;
    }

    var tabs = document.getElementsByClassName("tab");
    var nTabs = tabs.length - 1;
    if (nTabs == 1) {
      initTextarea();
      return;
    } else if (nTabs == 8) {
      setTimeout(function() {
        document.getElementById("create-tab").style.display = "block";
      }, 300);
    }

    if (activeTab) {
      // Move to another tab
      if (activeTab.index === nTabs - 1) {
        if (isNewTabCreated) {
          tabs[prevWorkingTabIdx].mousedown();
          isNewTabCreated = false;
        } else {
          tabs[activeTab.index - 1].mousedown();
        }
      } else {
        tabs[activeTab.index + 1].mousedown();
      }

      // Remove from document list
      docs.splice(activeTab.index, 1);
      chrome.storage.local.set({
        "documents": docs
      });

      // Tab removal animation
      activeTab.tab.innerHTML = "";
      activeTab.tab.style.padding = 0;
      activeTab.tab.style.width = 0;
      setTimeout(function () {
        document.getElementById("tabs").removeChild(activeTab.tab);
        Tab.resize();
      }, 300);
    }
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
