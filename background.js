chrome.runtime.onConnect.addListener(function(port) {
    port.onDisconnect.addListener(function() {
        var view = chrome.extension.getViews({ type: "popup" })[0];
        var themeselector = view.document.getElementById("select-theme");
        var fontsizeselector = view.document.getElementById("select-fontsize");
        var editor = view.document.getElementsByClassName("CodeMirror")[0].CodeMirror;
        if (editor.getValue().length > 0) {
            chrome.storage.local.set({
                'textdata': editor.getValue(),
                'scrollbar': editor.getScrollInfo(),
                'cursor': editor.getCursor(),

                'working_dirpath': view.document.getElementById("working-dirpath").value.replace(/\\+$/, ''),
                'localhost_port': view.document.getElementById("localhost-port").value,
                'theme': themeselector.options[themeselector.selectedIndex].textContent,
                'fontsize': fontsizeselector.options[fontsizeselector.selectedIndex].textContent,
                'attachment_location': view.document.getElementById('attachment-location').value.replace(/\/+$/, ''),
                'hashing': view.document.querySelector('input[name="hashing"]:checked').value
            });

            try {
                // JSON parsing test
                JSON.parse(document.getElementById('attachment-type').value);

                chrome.storage.local.set({
                    'attachment_type': view.document.getElementById('attachment-type').value.split(' ').join('')
                });
            } catch(e) {
            }
        }
    });
});
