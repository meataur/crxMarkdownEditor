let Scroll = (function () {
  var _scrollMap = null;
  var _isEditorScrolling = false;
  var _isViewerScrolling = false;

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
      if (!_isViewerScrolling && document.getElementById("editor-settings-scrollsync").checked) {
        _isEditorScrolling = true;

        var editorScroll = document.getElementsByClassName("CodeMirror-scroll")[0];
        var posRatio = editorScroll.scrollTop / (editorScroll.scrollHeight - editorScroll.clientHeight);
        viewer.scrollTop = (viewer.scrollHeight - viewer.clientHeight) * posRatio;

        // Get line number of current code line
        var lineHeight = parseInt(window.getComputedStyle(document.getElementsByClassName("CodeMirror-line")[0]).height);
        var lineNo = Math.floor(editorScroll.scrollTop / lineHeight);

        // TODO: work with line number
      }
      _isViewerScrolling = false;
    },
    onViewerScroll: function () {
      if (!_isEditorScrolling && document.getElementById("viewer-settings-scrollsync").checked) {
        _isViewerScrolling = true;

        var editorScroll = document.getElementsByClassName("CodeMirror-scroll")[0];
        var posRatio = viewer.scrollTop / (viewer.scrollHeight - viewer.clientHeight);
        editorScroll.scrollTop = (editorScroll.scrollHeight - editorScroll.clientHeight) * posRatio;
      }
      _isEditorScrolling = false;
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

        // Video

        // Something else
      } else {
        viewer.scrollTop = viewer.scrollPos;
        viewer.scrollPos = -1;
      }
    }
  }
})();
