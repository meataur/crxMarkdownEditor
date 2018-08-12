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
  return this.replace(new RegExp(src, 'g'), dst);
}

String.prototype.trimLeft = function (str) {
  if (str === "undefined") str = "\\s";
  return this.replace(new RegExp("^" + str + "+"), "");
}
String.prototype.trimRight = function (str) {
  if (str === "undefined") str = "\\s";
  return this.replace(new RegExp(str + "+$"), "");
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
  }
}
