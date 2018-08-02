IO.Local = (function () {
  let _createIframe = function (docTitle) {
    var ifrm = document.createElement("iframe");
    ifrm.style.position = "absolute";
    ifrm.style.display = "none";
    document.body.appendChild(ifrm);

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "preview.css");
    xhr.onload = function () {
      ifrm.contentWindow.document.open();
      ifrm.contentWindow.document.write("<html>\n<head>\n<title>" + docTitle + "</title>\n");
      ifrm.contentWindow.document.write("<style>" + xhr.responseText + "</style>\n");
      ifrm.contentWindow.document.write("</head>\n");
      ifrm.contentWindow.document.write("<body id=\"viewer\">\n" + document.getElementById("viewer").innerHTML + "</body>\n");
      ifrm.contentWindow.document.write("</html>");
      ifrm.contentWindow.document.close();
    }
    xhr.send();

    return ifrm;
  }

  return {
    open: function () {
      var input = document.createElement("input");
      input.type = "file";
      input.name = "file";
      input.accept = ".md,.markdown";
      input.addEventListener("change", function (e) {
        if (!IO.checkBeforeLeave()) return;

        var reader = new FileReader();
        reader.onload = function (evt) {
          if (evt.target.readyState == FileReader.DONE) {
            editor.setValue(evt.target.result);
            editor.focus();
            editor.setCursor(0, 0);

            var activeTab = Tab.getActive();
            docs[activeTab.index].texts_original = editor.getValue();
          }
        };
        reader.readAsText(e.target.files[0]);
      });
      input.click();
    },
    save: function () {
      IO.Local.saveAsMarkdown();
    },
    saveAsMarkdown: function () {
      if (editor) {
        // Parse document text data
        var data = editor.getValue();
        var parsed = parse(data);
        var docDatetime = (parsed.header.date && parsed.header.date.length) ? parsed.header.date : getCurDatetimeString();
        var docTitle = (parsed.header.title && parsed.header.title.length) ? parsed.header.title : "Untitled Document";
        var filename = docDatetime.split(" ")[0] + "-" + docTitle.replaceAll(" ", "-").toLowerCase() + ".md";

        // Create download link element
        chrome.downloads.download({
          url: URL.createObjectURL(new Blob([data], {
            type: "text/x-markdown"
          })),
          filename: filename,
          conflictAction: "overwrite",
          saveAs: true
        }, function (downloadId) {
          chrome.downloads.onChanged.addListener(function (e) {
            if (e.id == downloadId && e.state && e.state.current === "complete") {
              // Display alert message
              messageBox("Download Complete!");

              // Save workspace data
              var activeTab = Tab.getActive();
              docs[activeTab.index] = {
                last_modified: docs[activeTab.index].last_modified,
                texts_original: editor.getValue(),
                texts: editor.getValue(),
                scrollbar: editor.getScrollInfo(),
                cursor: editor.getCursor(),
                viewer_scroll: document.getElementById("viewer").scrollTop,
                active: true
              };
            }
          })
        });
      }
    },
    saveAsHtml: function () {
      var docTitle = Tab.getActive().tab.getElementsByClassName("doc-title")[0].innerHTML;
      var ifrm = _createIframe(docTitle);

      // Create download link element
      setTimeout(function () {
        chrome.downloads.download({
          url: "data:text/html;charset=utf-8," + encodeURIComponent(ifrm.contentWindow.document.documentElement.outerHTML),
          filename: docTitle + ".html",
          conflictAction: "overwrite",
          saveAs: true
        }, function (downloadId) {
          chrome.downloads.onChanged.addListener(function (e) {
            if (e.id == downloadId && e.state) {
              if (e.state.current === "complete") {
                messageBox("Download complete.");
                document.body.removeChild(ifrm);
              } else if (e.state.current === "interrupted") {
                document.body.removeChild(ifrm);
              }
            }
          });
        });
      }, 500);
    },
    saveAsPdf: function () {
      messageBox("Not support yet...");
    },
    print: function () {
      var docTitle = Tab.getActive().tab.getElementsByClassName("doc-title")[0].innerHTML;
      var ifrm = _createIframe(docTitle);
      setTimeout(function () {
        ifrm.contentWindow.focus();
        ifrm.contentWindow.print();
        document.body.removeChild(ifrm);
      }, 500);
    }
  }
})();