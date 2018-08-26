function PausableTimer(callback, delay) {
  var _timerId, _start, _remaining = delay;
  var _callback = callback;

  this.pause = function () {
    clearTimeout(_timerId);
    _remaining -= new Date() - _start;
  }
  this.resume = function () {
    _start = new Date();
    clearTimeout(_timerId);
    _timerId = setTimeout(_callback, _remaining);
  }
  this.reset = function (callback, delay) {
    if (typeof(callback) === "function") _callback = callback;
    if (typeof(delay) === "number") _remaining = delay;
    clearTimeout(timerId);
    _timerId = setTimeout(_callback, _remaining);
  }
  this.remainingtime = function () {
    return _remaining;
  }
}
