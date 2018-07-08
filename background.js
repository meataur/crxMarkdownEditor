chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.query({ url: chrome.extension.getURL("index.html") }, function(tabs) {
        if (tabs.length > 0) {
            // The extension was already opened in browser, make it active
            chrome.tabs.update(tabs[0].id, { active: true });
        } else {
            // Create a new tab for the extension
            chrome.tabs.create({ url: "index.html", index: tab.index + 1 }, function(newtab) {
                chrome.tabs.onRemoved.addListener(function(tabId, info) {
                    if (tabId === newtab.id) {
                        var view = chrome.extension.getViews({ type: "tab" })[0];
                        var editor = view.document.getElementsByClassName("CodeMirror")[0].CodeMirror;
                        var editor_texts = editor.getValue();
                        var editor_scrollbar = editor.getScrollInfo();
                        var editor_cursor = editor.getCursor();

                        var viewer = view.document.getElementById("viewer");
                        var viewer_scroll =  viewer.scrollTop;

                        // Find current active tab index and set its data
                        chrome.storage.local.get("documents", function(result) {
                            if (result.documents) {
                                var docs = result.documents;
                                var tabs = view.document.getElementsByClassName("tab");
                                for (var i = 0; i < tabs.length - 1; i++) {
                                    if (tabs[i].hasAttribute("active")) {
                                        // Update active document data
                                        docs[i] = {
                                            last_modified: docs[i].last_modified,
                                            texts_original: docs[i].texts_original,
                                            texts: editor_texts,
                                            scrollbar: editor_scrollbar,
                                            cursor: editor_cursor,
                                            viewer_scroll: viewer_scroll,
                                            active: true
                                        };

                                        // Save current work
                                        chrome.storage.local.set({ documents: docs });
                                        break;
                                    }
                                }
                            }
                        });

                        // Save setting values
                        var themeselector = view.document.getElementById("select-theme");
                        var fontsizeselector = view.document.getElementById("select-fontsize");
                        chrome.storage.local.set({
                            'theme': themeselector.options[themeselector.selectedIndex].textContent,
                            'fontsize': fontsizeselector.options[fontsizeselector.selectedIndex].textContent,
                            'attachment_location': view.document.getElementById('attachment-location').value.replace(/\/+$/, ''),
                            'hashing': view.document.querySelector('input[name="hashing"]:checked').value
                        });

                        try {
                            // JSON parsing test
                            JSON.parse(view.document.getElementById('attachment-type').value);
                            chrome.storage.local.set({
                                'attachment_type': view.document.getElementById('attachment-type').value.split(' ').join('')
                            });
                        } catch (err) {
                            console.log(err);
                        }
                    }
                });
            });
        }
    });
});
