let Scroll = (function () {
  var _scrollMap = null;
  var _syncWithEditor = false;
  var _syncWithViewer = false;
  return {
    onEditorScroll: function () {
      if (!_syncWithViewer && document.getElementById("editor-settings-scrollsync").checked) {
        _syncWithEditor = true;

        var editor = document.getElementsByClassName("CodeMirror-scroll")[0];
        var viewer = document.getElementById("viewer");
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
        var viewer = document.getElementById("viewer");
        var posRatio = viewer.scrollTop / (viewer.scrollHeight - viewer.clientHeight);
        editor.scrollTop = (editor.scrollHeight - editor.clientHeight) * posRatio;
      }
      _syncWithEditor = false;
    }
  }
})();
