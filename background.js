chrome.runtime.onConnect.addListener(function(port) {
    port.onDisconnect.addListener(function() {
        var view = chrome.extension.getViews({ type: "popup" })[0];
        var data = view.document.getElementsByClassName("CodeMirror")[0].CodeMirror.getValue();
        if (data.length > 0)
            chrome.storage.local.set({'textarea': data});
    });
});