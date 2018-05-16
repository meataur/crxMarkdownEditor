chrome.runtime.onConnect.addListener(function(port) {
    port.onDisconnect.addListener(function() {
        var view = chrome.extension.getViews({ type: "popup" })[0];
        var editor = view.document.getElementsByClassName("CodeMirror")[0].CodeMirror;
        if (editor.getValue().length > 0) {
            chrome.storage.local.set({
                'textdata': editor.getValue(),
                'scrollbar': editor.getScrollInfo(),
                'cursor': editor.getCursor()
            });
        }
    });
});