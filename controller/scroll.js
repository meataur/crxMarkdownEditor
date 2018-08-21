let Scroll = (function () {
  var _scrollMap = null;
  var _syncWithEditor = false;
  var _syncWithViewer = false;

  let _watcher = 0;
  let _numAttachmentFiles = 0;
  let _setScrollPos = function () {
    _watcher += 1;
    if (_watcher == _numAttachmentFiles) {
      viewer.scrollTop = viewer.scrollPos;
      viewer.scrollPos = -1;
    }
  }
  return {
    onEditorScroll: function () {
      if (!_syncWithViewer && document.getElementById("editor-settings-scrollsync").checked) {
        _syncWithEditor = true;

        var editor = document.getElementsByClassName("CodeMirror-scroll")[0];
        var posRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        viewer.scrollTop = (viewer.scrollHeight - viewer.clientHeight) * posRatio;

        // Get line number of current code line
        var lineHeight = parseInt(window.getComputedStyle(document.getElementsByClassName("CodeMirror-line")[0]).height);
        var lineNo = Math.floor(editor.scrollTop / lineHeight);

        // TODO: work with line number
      }
      _syncWithViewer = false;
    },
    onViewerScroll: function () {
      if (!_syncWithEditor && document.getElementById("viewer-settings-scrollsync").checked) {
        _syncWithViewer = true;

        var editor = document.getElementsByClassName("CodeMirror-scroll")[0];
        var posRatio = viewer.scrollTop / (viewer.scrollHeight - viewer.clientHeight);
        editor.scrollTop = (editor.scrollHeight - editor.clientHeight) * posRatio;
      }
      _syncWithEditor = false;
    },
    onViewerContentsLoaded: function () {
      _watcher = 0;
      _numAttachmentFiles = 0;

      var images = viewer.getElementsByTagName("img");
      _numAttachmentFiles += images.length;

      // Detect when all the attachment files in viewer are loaded
      if (_numAttachmentFiles) {
        // Images
        Array.from(images).forEach(function (image) {
          image.onerror = _setScrollPos;
          image.onabort = _setScrollPos;
          image.onload = _setScrollPos;
        });

        // Et cetera...
      } else {
        viewer.scrollTop = viewer.scrollPos;
        viewer.scrollPos = -1;
      }
    }
  }
})();
