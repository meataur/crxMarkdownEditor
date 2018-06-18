MathJax.Hub.Config({
    extensions: [
        "tex2jax.js", "TeX/AMSmath.js"
    ],
    jax: ["input/TeX", "output/HTML-CSS"],
    "HTML-CSS": {
        availableFonts: ["TeX"],
        imageFont: null
    },
    MathMenu: {
        showRenderer: false,
        showFontMenu: false,
        showLocale: false
    },
    showMathMenu: false,
    messageStyle: "none",
    tex2jax: {
        inlineMath: [ ['$','$'], ['\\(','\\)'], ['\\[','\\]'] ]
    }
});

window.addEventListener("DOMContentLoaded", function() {
    // Add caption under the figure
    var images = document.getElementsByTagName("img");
    for (var i = 0; i < images.length; i++) {
        // Set click event
        images[i].onclick = function() {
            window.location.href = this.src;
        }
        var alt = images[i].getAttribute("alt");
        if (alt) {
            var figcaption = document.createElement("figcaption");
            figcaption.innerHTML = "<strong>Figure " + (i + 1) + ".</strong>" + alt;
            images[i].parentNode.insertBefore(figcaption, images[i].nextSibling);
        }
    }

    // Add caption under the table
    var tables = document.getElementsByTagName("table");
    for (var i = 0; i < tables.length; i++) {
        var alt = tables[i].getAttribute("alt");
        if (alt) {
            var tablecaption = document.createElement("tablecaption");
            tablecaption.innerHTML = "<strong>Table " + (i + 1) + ".</strong>" + alt;
            tables[i].parentNode.insertBefore(tablecaption, tables[i].nextSibling);
        }
    }

    // Add title to anchor tags
    var aTags = document.getElementsByTagName("a");
    for (var i = 0; i < aTags.length; i++) {
        if (!aTags[i].hasAttribute("title")) {
            aTags[i].setAttribute("title", aTags[i].href);
        }
    }
});
