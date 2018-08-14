let Parser = (function () {
  const _working = Object.freeze({
    "READY": {},
    "METADATA": {},
    "BODY": {}
  });
  return {
    parse: function (data) {
      var parsed = {
        header: {},
        body: {
          hierarchy: "",
          texts: ""
        }
      }

      var prevLine = "";
      var curState = _working.READY;

      data = data.replace(/\r/gi, "");
      var lines = data.split("\n");
      for (var i = 0; i < lines.length; i++) {
        // Current line texts
        var curLine = lines[i];

        // Work with current line
        if (curState == _working.READY) {
          curLine = curLine.trim();
          if (!curLine.length)
            continue;

          if (curLine.startsWith("---")) { // At the beginning of post header
            curState = _working.METADATA;
          } else {
            curState = _working.BODY;
            i--;
          }
        } else if (curState == _working.METADATA) {
          curLine = curLine.trim();
          if (!curLine.length)
            continue;

          if (curLine.startsWith("---")) { // At the end of post header
            curState = _working.BODY;
          } else if (curLine.startsWith("#")) {
            // Skip this line because this line is a comment
          } else {
            // Save key-value pair of post header
            var key = curLine.split(":")[0].trim();
            var value = curLine.split(":").slice(1).join(":").trim().replace(/ +/g, ' ');
            if (key.length)
              parsed.header[key] = value;
          }
        } else if (curState == _working.BODY) {
          // Remove succeeding blank lines
          curLine = curLine.trimEnd();
          if (!curLine.length && !prevLine.length)
            continue;

          parsed.body["texts"] += curLine + "\n";
          prevLine = curLine;
        }
      }

      return parsed;
    },
    prettify: function () {

    }
  }
})();
