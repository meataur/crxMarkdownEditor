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
            var parsed = parse(evt.target.result);

            editor.setValue(parsed.body.texts);
            editor.focus();
            editor.setCursor(0, 0);
            
            var selectedTab = Tab.get();
            selectedTab.info = Tab.getInitData();
            selectedTab.info.metadata.type = "local";
            for (var key in parsed.header)
              selectedTab.info.metadata[key] = parsed.header[key];
            selectedTab.info.texts = editor.getValue();
            selectedTab.info.originalTexts = editor.getValue();
            Tab.set(selectedTab.index, selectedTab.info);
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
        var saveData = IO.makeSaveData();
        chrome.downloads.download({
          url: URL.createObjectURL(new Blob([saveData.texts], {
            type: "text/x-markdown"
          })),
          filename: saveData.filename,
          conflictAction: "overwrite",
          saveAs: true
        }, function (downloadId) {
          chrome.downloads.onChanged.addListener(function (e) {
            if (e.id == downloadId && e.state && e.state.current === "complete") {
              chrome.downloads.search({ id: downloadId }, function (result) {
                messageBox("Download Complete.");

                var selectedTab = Tab.get();
                for (var key in saveData.metadata) {
                  selectedTab.info.metadata[key] = saveData.metadata[key];
                }
                // selectedTab.info.metadata.comment = result[0].filename;
                selectedTab.info.texts = editor.getValue();
                selectedTab.info.originalTexts = editor.getValue();
                selectedTab.info.editor.scrollPos = editor.getScrollInfo();
                selectedTab.info.editor.cursor = editor.getCursor();
                selectedTab.info.viewer.scrollPos = document.getElementById("viewer").scrollTop;
                Tab.set(selectedTab.index, selectedTab.info);
              });
            }
          })
        });
      }
    },
    saveAsHtml: function () {
      var selectedTab = Tab.get();
      var ifrm = _createIframe(selectedTab.info.metadata.title);

      // Create download link element
      setTimeout(function () {
        chrome.downloads.download({
          url: "data:text/html;charset=utf-8," + encodeURIComponent(ifrm.contentWindow.document.documentElement.outerHTML),
          filename: selectedTab.info.metadata.title + ".html",
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
      // var doc = new jsPDF();
      // doc.fromHTML(document.getElementById("viewer"));
      // doc.save("document.pdf");
    },
    print: function () {
      var selectedTab = Tab.get();
      var ifrm = _createIframe(selectedTab.info.metadata.title);
      setTimeout(function () {
        ifrm.contentWindow.focus();
        ifrm.contentWindow.print();
        document.body.removeChild(ifrm);
      }, 500);
    }
  }
})();