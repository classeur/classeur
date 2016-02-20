angular.module('classeur.extensions.mathJax', [])
  .directive('clMathJax',
    function ($window, clEditorSvc) {
      var config, mathJaxScript

      clEditorSvc.onMarkdownInit(2, function (markdown) {
        if (config) {
          markdown.use($window.markdownitMathjax)
          !mathJaxScript && initMathJax()
          clEditorSvc.onAsyncPreview(function (cb) {
            if (!updateMathJax) {
              return cb()
            }
            typesetCallback = cb
            updateMathJax()
          })
        }

        clEditorSvc.setPrismOptions({
          maths: !!config
        })
      })

      function initMathJax () {
        mathJaxScript = document.createElement('script')
        mathJaxScript.src = 'https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML&delayStartupUntil=configured'
        mathJaxScript.onload = onMathJaxLoaded
        mathJaxScript.onerror = function () {
          mathJaxScript = undefined
        }
        document.head.appendChild(mathJaxScript)
      }

      var typesetCallback
      var updateMathJax
      var pending = false

      function applyConfig () {
        if (!config || !$window.MathJax) {
          return
        }
        $window.MathJax.Hub.Config(JSON.parse(JSON.stringify(config)))
        $window.MathJax.Hub.Configured()
      }

      function onMathJaxLoaded () {
        var MathJax = $window.MathJax
        var HUB = $window.MathJax.Hub
        applyConfig()

        //
        //  This is run to restart MathJax after it has finished
        //    the previous run (that may have been canceled)
        //
        function RestartMJ () {
          pending = false
          HUB.cancelTypeset = false
          HUB.Queue([
            'Typeset',
            HUB
          ])
          HUB.Queue(typesetCallback) // benweet
        }

        //
        //  When the preview changes, cancel MathJax and restart,
        //    if we haven't done that already.
        //
        updateMathJax = function () {
          if (!pending /* benweet (we need to call our afterRefreshCallback) && ready */) {
            pending = true
            HUB.Cancel()
            HUB.Queue(RestartMJ)
          }
        }

        //
        //  Runs after initial typeset
        //
        HUB.Queue(function () {
          HUB.processUpdateTime = 50
          HUB.Config({
            'HTML-CSS': {
              EqnChunk: 10,
              EqnChunkFactor: 1
            },
            SVG: {
              EqnChunk: 10,
              EqnChunkFactor: 1
            }
          })
        })

        if (!HUB.Cancel) {
          HUB.cancelTypeset = false
          HUB.Register.StartupHook('HTML-CSS Jax Config', function () {
            var HTMLCSS = MathJax.OutputJax['HTML-CSS']
            var TRANSLATE = HTMLCSS.Translate
            HTMLCSS.Augment({
              Translate: function (script, state) {
                if (HUB.cancelTypeset || state.cancelled) {
                  throw Error('MathJax Canceled')
                }
                return TRANSLATE.call(HTMLCSS, script, state)
              }
            })
          })
          HUB.Register.StartupHook('SVG Jax Config', function () {
            var SVG = MathJax.OutputJax.SVG
            var TRANSLATE = SVG.Translate
            SVG.Augment({
              Translate: function (script, state) {
                if (HUB.cancelTypeset || state.cancelled) {
                  throw Error('MathJax Canceled')
                }
                return TRANSLATE.call(SVG,
                  script, state)
              }
            })
          })
          HUB.Register.StartupHook('TeX Jax Config', function () {
            var TEX = MathJax.InputJax.TeX
            var TRANSLATE = TEX.Translate
            TEX.Augment({
              Translate: function (script, state) {
                if (HUB.cancelTypeset || state.cancelled) {
                  throw Error('MathJax Canceled')
                }
                return TRANSLATE.call(TEX, script, state)
              }
            })
          })
          var PROCESSERROR = HUB.processError
          HUB.processError = function (error, state, type) {
            if (error.message !== 'MathJax Canceled') {
              return PROCESSERROR.call(HUB, error, state, type)
            }
            MathJax.Message.Clear(0, 0)
            state.jaxIDs = []
            state.jax = {}
            state.scripts = []
            state.i = state.j = 0
            state.cancelled = true
            return null
          }
          HUB.Cancel = function () {
            this.cancelTypeset = true
          }
        }
      }

      return {
        restrict: 'A',
        link: link
      }

      function link (scope) {
        function checkConfig () {
          var fileProperties = scope.currentFile.content.properties

          var newConfig = fileProperties['ext:mathjax'] !== 'false' ? (function () {
            var tex2jax, tex
            try {
              tex2jax = JSON.parse(fileProperties['ext:mathjax:tex2jax'])
            } catch (e) {}
            try {
              tex = JSON.parse(fileProperties['ext:mathjax:tex'])
            } catch (e) {}

            return {
              'HTML-CSS': {
                preferredFont: 'TeX',
                availableFonts: [
                  'TeX'
                ],
                linebreaks: {
                  automatic: true
                },
                EqnChunk: 10,
                imageFont: null
              },
              tex2jax: ({
                inlineMath: [
                  [
                    '\\(',
                    '\\)'
                  ]
                ],
                displayMath: [
                  [
                    '\\[',
                    '\\]'
                  ]
                ],
                processEscapes: true
              }).cl_extend(tex2jax),
              TeX: ({
                noUndefined: {
                  attributes: {
                    mathcolor: 'red',
                    mathbackground: '#FFEEEE',
                    mathsize: '90%'
                  }
                },
                Safe: {
                  allow: {
                    URLs: 'safe',
                    classes: 'safe',
                    cssIDs: 'safe',
                    styles: 'safe',
                    fontsize: 'all'
                  }
                }
              }).cl_extend(tex),
              messageStyle: 'none'
            }
          })() : undefined
          if (JSON.stringify(newConfig) !== JSON.stringify(config)) {
            config = newConfig
            applyConfig()
            return true
          }
        }

        checkConfig()
        scope.$watch('currentFile.content.properties', function (properties) {
          if (properties && checkConfig()) {
            clEditorSvc.initConverter()
          }
        })
      }
    })
