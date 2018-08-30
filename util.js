// Create mousedown event
var mousedownEvent = new MouseEvent("mousedown");
Element.prototype.mousedown = function () {
  this.dispatchEvent(mousedownEvent);
}

// Set function to get ancestor element
Element.prototype.getAncestorByTagName = function (tagName) {
  var ancestor = this;
  tagName = tagName.toLowerCase();
  while (ancestor.tagName.toLowerCase() !== "body" && ancestor.tagName.toLowerCase() !== tagName)
    ancestor = ancestor.parentNode;
  return (ancestor.tagName.toLowerCase() === "body") ? null : ancestor;
}
Element.prototype.getAncestorByClassName = function (className) {
  var ancestor = this;
  className = className.toLowerCase();
  while (ancestor.tagName.toLowerCase() !== "body" && !ancestor.classList.contains(className))
    ancestor = ancestor.parentNode;
  return (ancestor.tagName.toLowerCase() === "body") ? null : ancestor;
}

// Remove all child elements
Element.prototype.removeAllChildren = function () {
  while (this.firstChild)
    this.removeChild(this.firstChild);
}



/**
 * String prototype overriding
 */

String.prototype.replaceAll = function (src, dst) {
  return this.replace(new RegExp(src, "gi"), dst);
}

String.prototype.trimLeft = function (str) {
  if (str === "undefined") str = "\\s";
  return this.replace(new RegExp("^" + str + "+", "i"), "");
}
String.prototype.trimRight = function (str) {
  if (str === "undefined") str = "\\s";
  return this.replace(new RegExp(str + "+$", "i"), "");
}

String.prototype.contains = function (substr) {
  return this.indexOf(substr) !== -1;
}



/**
 * Utility functions
 */

let Util = {
  sleep: function (milliseconds) {
    var start = new Date().getTime();
    while (true) {
      if ((new Date().getTime() - start) >= milliseconds)
        break;
    }
  },
  curtime: function () {
    var now = new Date();
    now.setTime(now.getTime() - (now.getTimezoneOffset() * 60 * 1000));
    var strDatetime = now.getUTCFullYear() + "-" + ("0" + (now.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + now.getUTCDate()).slice(-2);
    strDatetime += " " + ("0" + now.getUTCHours()).slice(-2) + ":" + ("0" + now.getUTCMinutes()).slice(-2) + ":" + ("0" + now.getUTCSeconds()).slice(-2);
    return strDatetime;
  },
  debounce: function (func, wait, immediate) {
    var timeout;
    return function () {
      var context = this, args = arguments;
      var later = function () {
        timeout = null;
        if (!immediate) func.apply(context, args);
      }
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    }
  },
  Converter: {
    dataUriToBlob: function (dataURI) {
      var byteString = atob(dataURI.split(",")[1]);
      var mime = dataURI.split(",")[0].match(/data:(.+\/.+);base64/)[1];
      var buffer = new ArrayBuffer(byteString.length);
      var ui8a = new Uint8Array(buffer);
      for (var i = 0; i < byteString.length; i++) {
        ui8a[i] = byteString.charCodeAt(i);
      }
      return new Blob([buffer], { type: mime });
    },
    stringToHash: function (texts, hashfunc) {
      if (hashfunc == null)
        return CryptoJS.SHA256(texts).toString();
      else if (hashfunc == "md5")
        return CryptoJS.MD5(texts).toString(); 
      else if (hashfunc == "sha1")
        return CryptoJS.SHA1(texts).toString();
      else if (hashfunc == "sha224")
        return CryptoJS.SHA224(texts).toString();
      else if (hashfunc == "sha256")
        return CryptoJS.SHA256(texts).toString();
      else if (hashfunc == "sha512")
        return CryptoJS.SHA512(texts).toString();
      return "";
    }
  },
  Extractor: {
    filename: function (fullpath) {
      return fullpath.replace(/^.*[\\\/]/, '');
    }
  }
}
