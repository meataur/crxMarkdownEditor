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
