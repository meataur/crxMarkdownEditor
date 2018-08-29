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
        ifrm.contentWindow.document.write("<style>\n");
        ifrm.contentWindow.document.write("*, *:before, *:after { margin: 0; padding: 0; box-sizing: border-box; }\n");
        ifrm.contentWindow.document.write("*:focus { outline: none; }\n");
        ifrm.contentWindow.document.write("</style>\n");
        ifrm.contentWindow.document.write("<style>" + this.responseText + "</style>\n");

        _get("lib/highlight-9.12.0/styles/" + document.getElementById("viewer-settings-codestyle").value + ".css", function () {
          ifrm.contentWindow.document.write("<style>" + this.responseText + "</style>\n");
          ifrm.contentWindow.document.write("</head>\n");
          ifrm.contentWindow.document.write("<body class=\"preview\">\n" + viewer.innerHTML + "</body>\n");
          ifrm.contentWindow.document.write("</html>");
          ifrm.contentWindow.document.close();
        }, function () {
          ifrm.contentWindow.document.write("</head>\n");
          ifrm.contentWindow.document.write("<body class=\"preview\">\n" + viewer.innerHTML + "</body>\n");
          ifrm.contentWindow.document.write("</html>");
          ifrm.contentWindow.document.close();
        });
      });
    });

    return ifrm;
  }
  let _html2canvas = function (el, scale, callback) {
    // Adjust layer's width and height to A4 paper size
    var imgWidth = Math.floor(210 / 0.26); // 0.26458333
    el.style.width = imgWidth + "px";
    var imgHeight = parseInt(el.scrollHeight);
    el.removeAttribute("style");
    var imgBackground = el.style.background ? el.style.background : "#fff";

    // Make entire page
    var entirePage = document.createElement("div");
    entirePage.className = "preview";
    entirePage.style.width = imgWidth + "px";
    entirePage.style.height = imgHeight + "px";
    entirePage.style.background = imgBackground;
    entirePage.style.overflow = "hidden";
    entirePage.innerHTML = el.innerHTML;
    document.body.appendChild(entirePage);

    html2canvas(entirePage, {
      background: imgBackground,
      allowTaint: true,
      scale: scale,
      logging: Developer.debug
    }).then(function (canvas) {
      entirePage.parentNode.removeChild(entirePage);
      callback(canvas);
    });
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
              new MessageBox("Download Complete.").show();

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
          filename: IO.filename() + ".html",
          conflictAction: "overwrite",
          saveAs: true
        }, function (downloadId) {
          chrome.downloads.onChanged.addListener(function (e) {
            if (e.id == downloadId && e.state) {
              if (e.state.current === "complete") {
                new MessageBox("Download complete.").show();
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
      var msgbox = new MessageBox("Generating screenshot image...\n(It may takes a few seconds.)", false);
      msgbox.show();

      _html2canvas(viewer, 2, function (canvas) {
        var imgData = canvas.toDataURL("image/png");
        msgbox.config("Screenshot image is ready.", true);

        // Convert data URI to blob object
        var imgBlob = Util.Converter.dataUriToBlob(imgData);

        // Open blob object to new tab
        chrome.tabs.create({
          url: URL.createObjectURL(imgBlob)
        }, function (tab) {
          chrome.downloads.download({
            url: imgData,
            filename: IO.filename() + ".png",
            conflictAction: "overwrite",
            saveAs: true
          }, function (downloadId) {
            chrome.downloads.onChanged.addListener(function (e) {
              if (e.id == downloadId && e.state) {
                if (e.state.current === "complete") {
                  new MessageBox("Download complete.").show();
                } else if (e.state.current === "interrupted") {
                  // Do nothing
                }
              }
            });
          });
        });
      });
    },
    saveAsPdf: function () {
      var msgbox = new MessageBox("Generating PDF document...\n(It may takes a few seconds.)", false);
      msgbox.show();

      _html2canvas(viewer, 2, function (canvas) {
        var pdf = new jsPDF("p", "mm", "a4");
        var pageRatio = pdf.internal.pageSize.getHeight() / pdf.internal.pageSize.getWidth();
        var pageWidth = canvas.width;
        var pageHeight = Math.floor(canvas.width * pageRatio);
        var pageWidthInMm = pdf.internal.pageSize.getWidth();    // (pageWidth / scale) * 0.26458333;
        var pageHeightInMm = pdf.internal.pageSize.getHeight();  // (pageHeight / scale) * 0.26458333;

        // Calculate PDF document pages
        var pages = 0;
        var remnant = canvas.height;
        while (remnant > 0) {
          remnant -= pages ? Math.floor(pageHeight * 0.99) : pageHeight;
          pages += 1;
        }

        for (var page = 0; page < pages; page++) {
          var pageCanvas = document.createElement("canvas");
          pageCanvas.setAttribute("width", pageWidth);
          pageCanvas.setAttribute("height", pageHeight);
          
          var context = pageCanvas.getContext("2d");
          context.drawImage(canvas, 0, Math.floor(pageHeight * 0.99) * page, pageWidth, pageHeight, 0, 0, pageWidth, pageHeight);

          if (page) pdf.addPage();
          pdf.setPage(page + 1);

          var pageCanvasDataURL = pageCanvas.toDataURL("image/png", 1.0);
          pdf.addImage(pageCanvasDataURL, "PNG", 11, 11, pageWidthInMm - 22, pageHeightInMm - 22);

          var pageNo = (page + 1) + "/" + pages;
          var offsetX = pageWidthInMm - 11;
          var offsetY = pageHeightInMm - 6;
          pdf.setFontSize(8);
          pdf.text(pageNo, offsetX, offsetY, null, null, "right");
        }

        var pdfBlob = pdf.output("blob");
        msgbox.config("PDF generation is complete.", true);

        // Open blob object to new tab
        chrome.tabs.create({
          url: URL.createObjectURL(pdfBlob)
        }, function (tab) {
          chrome.downloads.download({
            url: URL.createObjectURL(pdfBlob),
            filename: IO.filename() + ".pdf",
            conflictAction: "overwrite",
            saveAs: true
          }, function (downloadId) {
            chrome.downloads.onChanged.addListener(function (e) {
              if (e.id == downloadId && e.state) {
                if (e.state.current === "complete") {
                  new MessageBox("Download complete.").show();
                } else if (e.state.current === "interrupted") {
                  // Do nothing
                }
              }
            });
          });
        });
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