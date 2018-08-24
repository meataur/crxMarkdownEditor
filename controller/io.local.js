IO.Local = (function () {
  let _get = function (uri, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", uri);
    xhr.onload = onload;
    xhr.onerror = onerror;
    xhr.send();
  }
  let _createIframe = function (docTitle) {
    var ifrm = document.createElement("iframe");
    ifrm.style.position = "absolute";
    ifrm.style.display = "none";
    document.body.appendChild(ifrm);

    _get("lib/katex-0.10.0/katex.print.min.css", function () {
      ifrm.contentWindow.document.open();
      ifrm.contentWindow.document.write("<html>\n<head>\n<title>" + docTitle + "</title>\n");
      ifrm.contentWindow.document.write("<style>" + this.responseText + "</style>\n");

      _get("preview.css", function () {
        ifrm.contentWindow.document.write("<style>" + this.responseText + "</style>\n");

        _get("lib/highlight-9.12.0/styles/" + document.getElementById("viewer-settings-codestyle").value + ".css", function () {
          ifrm.contentWindow.document.write("<style>" + this.responseText + "</style>\n");
          ifrm.contentWindow.document.write("</head>\n");
          ifrm.contentWindow.document.write("<body id=\"viewer\">\n" + viewer.innerHTML + "</body>\n");
          ifrm.contentWindow.document.write("</html>");
          ifrm.contentWindow.document.close();
        }, function () {
          ifrm.contentWindow.document.write("</head>\n");
          ifrm.contentWindow.document.write("<body id=\"viewer\">\n" + viewer.innerHTML + "</body>\n");
          ifrm.contentWindow.document.write("</html>");
          ifrm.contentWindow.document.close();
        });
      });
    });

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
            var parsed = Parser.parse(evt.target.result);

            viewer.scrollTop = 0;
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

            // Set metadata to each panel elements
            Dialog.Metadata.setData(selectedTab.info.metadata);

            // Manually trigger onchange events
            document.getElementById("select-metadata-type").dispatchEvent(new Event("change"));
            document.getElementById("input-metadata-title").dispatchEvent(new Event("change"));
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
            chrome.downloads.search({
              id: downloadId
            }, function (result) {
              messageBox("Download Complete.");

              var selectedTab = Tab.get();
              for (var key in saveData.metadata) {
                selectedTab.info.metadata[key] = saveData.metadata[key];
              }
              // selectedTab.info.metadata.description = result[0].filename;
              selectedTab.info.metadata.type = "local";
              selectedTab.info.texts = editor.getValue();
              selectedTab.info.originalTexts = editor.getValue();
              selectedTab.info.editor.scrollPos = editor.getScrollInfo();
              selectedTab.info.editor.cursor = editor.getCursor();
              selectedTab.info.viewer.scrollPos = viewer.scrollTop;

              // Set metadata to each panel elements
              Dialog.Metadata.setData(selectedTab.info.metadata);

              // Manually trigger onchange events
              document.getElementById("select-metadata-type").dispatchEvent(new Event("change"));
            });
          }
        });
      });
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
    saveAsImage: function () {
      messageBox("Generating screenshot image...\n(It may takes a few seconds.)");

      var imgWidth = parseInt(viewer.scrollWidth);
      var imgHeight = parseInt(viewer.scrollHeight);
      var imgBackground = viewer.style.background ? viewer.style.background : "#fff";

      var hidden = document.createElement("div");
      hidden.id = "viewer";
      hidden.style.width = parseInt(viewer.style.width) + "px";
      hidden.style.height = parseInt(viewer.scrollHeight) + "px";
      hidden.style.background = imgBackground;
      hidden.innerHTML = viewer.innerHTML;
      document.body.appendChild(hidden);

      html2canvas(viewer, {
        widht: imgWidth,
        height: imgHeight,
        background: imgBackground,
        onrendered: function (canvas) {
          hidden.parentNode.removeChild(hidden);

          var imgData = canvas.toDataURL("image/png");

          chrome.downloads.download({
            url: imgData,
            filename: IO.filename() + ".png",
            conflictAction: "overwrite",
            saveAs: true
          }, function (downloadId) {
            chrome.downloads.onChanged.addListener(function (e) {
              if (e.id == downloadId && e.state) {
                if (e.state.current === "complete") {
                  messageBox("Download complete.");
                } else if (e.state.current === "interrupted") {
                  // Do nothing
                }
              }
            });
          });
        }
      });
    },
    saveAsPdf: function () {
      messageBox("Generating PDF document...\n(It may takes a few seconds.)");

      var imgWidth = parseInt(viewer.scrollWidth);
      var imgHeight = parseInt(viewer.scrollHeight);
      var imgBackground = viewer.style.background ? viewer.style.background : "#fff";

      var hidden = document.createElement("div");
      hidden.id = "viewer";
      hidden.style.width = imgWidth + "px";
      hidden.style.height = imgHeight + "px";
      hidden.style.background = imgBackground;
      hidden.innerHTML = viewer.innerHTML;
      document.body.appendChild(hidden);

      html2canvas(viewer, {
        widht: imgWidth,
        height: imgHeight,
        background: imgBackground,
        onrendered: function (canvas) {
          hidden.parentNode.removeChild(hidden);

          var imgData = canvas.toDataURL("image/png");

          var pdf = new jsPDF("p", "mm", [imgWidth * 0.26458333, imgHeight * 0.26458333]);
          pdf.addImage(imgData, "PNG", 0, 0, imgWidth * 0.26458333, imgHeight * 0.26458333);

          chrome.downloads.download({
            url: pdf.output("datauristring"),
            filename: IO.filename() + ".pdf",
            conflictAction: "overwrite",
            saveAs: true
          }, function (downloadId) {
            chrome.downloads.onChanged.addListener(function (e) {
              if (e.id == downloadId && e.state) {
                if (e.state.current === "complete") {
                  messageBox("Download complete.");
                } else if (e.state.current === "interrupted") {
                  // Do nothing
                }
              }
            });
          });
        }
      });
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