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

  let _getallstyle = function (el) {
    var data = {}
    var computed = getComputedStyle(el);
    for (var i = 0; i < computed.length; i++) {
      data[computed[i]] = computed.getPropertyValue(computed[i]);
    }
    return data;
  }

  let _html2canvas = function (el, scale, styleOptions, callback) {
    // Adjust layer's width to A4 paper size
    styleOptions["width"] = Math.floor(210 / 0.26) + "px"; // 0.26458333
    Object.keys(styleOptions).forEach(function (key) {
      el.style[key] = styleOptions[key];
    });

    // Re-calculate page's height
    styleOptions["height"] = el.scrollHeight + "px";
    styleOptions["overflow-x"] = "hidden";
    styleOptions["overflow-y"] = "hidden";

    // Reset element's style
    el.removeAttribute("style");

    // Make entire page
    var entirePage = document.createElement("div");
    entirePage.className = el.className;
    Object.keys(styleOptions).forEach(function (key) {
      entirePage.style[key] = styleOptions[key];
    });
    entirePage.innerHTML = el.innerHTML;
    document.body.appendChild(entirePage);

    html2canvas(entirePage, {
      allowTaint: true,
      scale: scale,
      logging: Config.debug
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
        reader.fname = e.target.files[0].name;
        reader.onloadend = function (evt) {
          if (Config.debug) {
            console.log(evt.target.readyState);
            console.log(evt.target.result);
          }

          if (evt.target.readyState == FileReader.DONE) {
            var parsed = Parser.parse(evt.target.result);

            viewer.scrollTop = 0;
            editor.setValue(parsed.body.texts);
            editor.focus();
            editor.setCursor(0, 0);

            var selectedTab = Tab.get();
            selectedTab.info = Tab.getInitData();
            selectedTab.info.filename = evt.target.fname;
            if (parsed) {
              for (var key in parsed.header)
                selectedTab.info.metadata[key] = parsed.header[key];
            }
            selectedTab.info.metadata.type = "local";
            selectedTab.info.metadata.id = IO.filehash(selectedTab.info.metadata, editor.getValue());
            selectedTab.info.hash = selectedTab.info.metadata.id;
            selectedTab.info.texts = editor.getValue();

            // Update tab info
            Tab.set(selectedTab.index, selectedTab.info);

            // Set metadata to each panel elements
            Dialog.Metadata.setData(selectedTab.info.metadata);

            // Manually trigger onchange events
            document.getElementById("input-metadata-title").setAttribute("placeholder", selectedTab.info.filename);
            document.getElementById("input-metadata-title").dispatchEvent(new Event("change"));
            document.getElementById("select-metadata-type").dispatchEvent(new Event("change"));
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
          if (Config.debug) {
            console.log(e.state);
            console.log(editor.getValue());
          }

          if (e.id == downloadId && e.state && e.state.current === "complete") {
            chrome.downloads.search({
              id: downloadId
            }, function (result) {
              new MessageBox("Download Complete.").show();

              var selectedTab = Tab.get();
              selectedTab.info.filename = Util.Extractor.filename(result[0].filename);
              for (var key in saveData.metadata) {
                selectedTab.info.metadata[key] = saveData.metadata[key];
              }
              selectedTab.info.metadata.type = "local";
              selectedTab.info.metadata.id = IO.filehash(selectedTab.info.metadata, editor.getValue());
              selectedTab.info.hash = selectedTab.info.metadata.id;
              selectedTab.info.texts = editor.getValue();
              selectedTab.info.editor.scrollPos = editor.getScrollInfo();
              selectedTab.info.editor.cursor = editor.getCursor();
              selectedTab.info.viewer.scrollPos = viewer.scrollTop;

              // Update tab info
              Tab.set(selectedTab.index, selectedTab.info);

              // Set metadata to each panel elements
              Dialog.Metadata.setData(selectedTab.info.metadata);

              // Manually trigger onchange events
              document.getElementById("input-metadata-title").setAttribute("placeholder", selectedTab.info.filename);
              document.getElementById("input-metadata-title").dispatchEvent(new Event("change"));
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

      var styleOptions = {}
      if (viewer.hasAttribute("htmlcode")) {
        styleOptions["white-space"] = "normal";
        styleOptions["word-break"] = "break-all";
      }

      _html2canvas(viewer, 2, styleOptions, function (canvas) {
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

      var styleOptions = {}
      if (viewer.hasAttribute("htmlcode")) {
        styleOptions["white-space"] = "normal";
        styleOptions["word-break"] = "break-all";
      }

      _html2canvas(viewer, 2, styleOptions, function (canvas) {
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
