let MessageBox = function (texts, autohide) {
  if (autohide == null) autohide = true;

  let _msgbox = document.createElement("messagebox");
  let _timer = null;

  let _hidefunc = function () {
    _msgbox.style.opacity = 0;
    setTimeout(function () {
      _msgbox.parentNode.removeChild(_msgbox);
    }, 300);
  }

  // Set texts in messagebox
  _msgbox.innerHTML = texts.replace(/\n/g, '<br />');

  // Set timer if auto-hide is turned on
  if (autohide) {
    var duration = texts.length * 100;
    duration = duration > 3500 ? 3500 : duration;
    duration = duration < 1500 ? 1500 : duration;

    _timer = new PausableTimer(_hidefunc, duration);
    _msgbox.onmouseover = function (e) { if (_timer) _timer.pause(); }
    _msgbox.onmouseout = function (e) { if (_timer) _timer.resume(); }
  }

  // Messagebox methods
  this.show = function () {
    var outer = document.createElement("div");
    outer.appendChild(_msgbox);
    document.getElementById("messagebox-wrapper").appendChild(outer);

    // Show messagebox
    setTimeout(function () {
      _msgbox.style.opacity = 1;
    }, 100);
    if (autohide && _timer) {
      _timer.resume();
    }
  }
  this.hide = _hidefunc;
  this.config = function (texts, autohide) {
    if (texts)
      _msgbox.innerHTML = texts.replace(/\n/g, '<br />');

    if (autohide) {
      var duration = texts.length * 100;
      duration = duration > 3500 ? 3500 : duration;
      duration = duration < 1500 ? 1500 : duration;

      if (_timer) {
        _timer.reset(null, duration);
      } else {
        _timer = new PausableTimer(_hidefunc, duration);
        _msgbox.onmouseover = function (e) { if (_timer) _timer.pause(); }
        _msgbox.onmouseout = function (e) { if (_timer) _timer.resume(); }
        _timer.resume();
      }
    }
  }
}
