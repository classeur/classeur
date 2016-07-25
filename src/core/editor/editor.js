angular.module('classeur.core.editor', [])
  .directive('clEditor',
    function ($window, $templateCache, $$sanitizeUri, clEditorSvc, clExtensionSvc, clEditorLayoutSvc, clSettingSvc, clEditorContentSvc) {
      return {
        restrict: 'E',
        template: $templateCache.get('core/editor/editor.html'), // Prevent from template loading to be async
        link: link
      }

      function link (scope, element) {
        var editorElt = element[0].querySelector('.editor')
        var editorInnerElt = element[0].querySelector('.editor__inner')
        clEditorSvc.setEditorElt(editorInnerElt)
        clEditorSvc.pagedownEditor.hooks.set('insertLinkDialog', function (callback) {
          clEditorSvc.linkDialogCallback = callback
          clEditorLayoutSvc.currentControl = 'linkDialog'
          scope.$evalAsync()
          return true
        })
        clEditorSvc.pagedownEditor.hooks.set('insertImageDialog', function (callback) {
          clEditorSvc.imageDialogCallback = callback
          clEditorLayoutSvc.currentControl = 'imageDialog'
          scope.$evalAsync()
          return true
        })

        var state
        scope.$on('$destroy', function () {
          state = 'destroyed'
        })

        function isDestroyed () {
          return state === 'destroyed'
        }

        function saveState () {
          scope.currentFile.content.state = {
            selectionStart: clEditorSvc.cledit.selectionMgr.selectionStart,
            selectionEnd: clEditorSvc.cledit.selectionMgr.selectionEnd,
            scrollPosition: clEditorSvc.getScrollPosition() || scope.currentFile.content.state.scrollPosition
          }
        }
        editorElt.addEventListener('scroll', $window.cledit.Utils.debounce(saveState, 100))

        var newSectionList, newSelectionRange
        var debouncedEditorChanged = $window.cledit.Utils.debounce(function () {
          if (!isDestroyed()) {
            if (clEditorSvc.sectionList !== newSectionList) {
              clEditorSvc.sectionList = newSectionList
              state ? debouncedRefreshPreview() : refreshPreview()
            }
            clEditorSvc.selectionRange = newSelectionRange
            saveState()
            scope.$apply()
          }
        }, 10)

        function refreshPreview () {
          clEditorSvc.convert()
          if (!state) {
            clEditorSvc.refreshPreview()
            clEditorSvc.measureSectionDimensions()
            clEditorSvc.restoreScrollPosition()
          } else {
            setTimeout(clEditorSvc.refreshPreview, 10)
          }
          state = 'ready'
        }

        var debouncedRefreshPreview = $window.cledit.Utils.debounce(function () {
          if (!isDestroyed()) {
            refreshPreview()
            scope.$apply()
          }
        }, 20)

        clEditorSvc.cledit.selectionMgr.on('selectionChanged', function (start, end, selectionRange) {
          newSelectionRange = selectionRange
          debouncedEditorChanged()
        })

        /* -----------------------------
         * Inline images
         */

        var imgCache = Object.create(null)

        function addToImgCache (imgElt) {
          var entries = imgCache[imgElt.src]
          if (!entries) {
            entries = []
            imgCache[imgElt.src] = entries
          }
          entries.push(imgElt)
        }

        function getFromImgCache (src) {
          var entries = imgCache[src]
          if (entries) {
            var imgElt
            return entries.cl_some(function (entry) {
              if (!editorInnerElt.contains(entry)) {
                imgElt = entry
                return true
              }
            }) && imgElt
          }
        }

        var triggerImgCacheGc = $window.cledit.Utils.debounce(function () {
          Object.keys(imgCache).cl_each(function (src) {
            var entries = imgCache[src].filter(function (imgElt) {
              return editorInnerElt.contains(imgElt)
            })
            if (entries.length) {
              imgCache[src] = entries
            } else {
              delete imgCache[src]
            }
          })
        }, 100)
        var imgEltsToCache = []

        if (clSettingSvc.values.editorInlineImg) {
          clEditorSvc.cledit.highlighter.on('sectionHighlighted', function (section) {
            section.elt.getElementsByClassName('token img').cl_each(function (imgTokenElt) {
              var srcElt = imgTokenElt.querySelector('.token.cl-src')
              if (srcElt) {
                // Create an img element before the .img.token and wrap both elements into a .token.img-wrapper
                var imgElt = $window.document.createElement('img')
                imgElt.style.display = 'none'
                var uri = srcElt.textContent
                if (!/^unsafe/.test($$sanitizeUri(uri, true))) {
                  imgElt.onload = function () {
                    imgElt.style.display = ''
                  }
                  imgElt.src = uri
                  imgEltsToCache.push(imgElt)
                }
                var imgTokenWrapper = $window.document.createElement('span')
                imgTokenWrapper.className = 'token img-wrapper'
                imgTokenElt.parentNode.insertBefore(imgTokenWrapper, imgTokenElt)
                imgTokenWrapper.appendChild(imgElt)
                imgTokenWrapper.appendChild(imgTokenElt)
              }
            })
          })
        }

        clEditorSvc.cledit.highlighter.on('highlighted', function () {
          imgEltsToCache.cl_each(function (imgElt) {
            var cachedImgElt = getFromImgCache(imgElt.src)
            if (cachedImgElt) {
              // Found a previously loaded image that has just been released
              imgElt.parentNode.replaceChild(cachedImgElt, imgElt)
            } else {
              addToImgCache(imgElt)
            }
          })
          imgEltsToCache = []
          // Eject released images from cache
          triggerImgCacheGc()
        })

        clEditorSvc.cledit.on('contentChanged', function (content, diffs, sectionList) {
          newSectionList = sectionList
          debouncedEditorChanged()
        })

        scope.$watch('currentFile.content.properties', function (properties) {
          var options = properties && clExtensionSvc.getOptions(properties, true)
          if (JSON.stringify(options) !== JSON.stringify(clEditorSvc.options)) {
            clEditorSvc.setOptions(options)
            clEditorSvc.initPrism()
            clEditorSvc.initConverter()
          }
        })

        var isInited
        scope.$watch('editorSvc.options', function () {
          clEditorSvc.initCledit(isInited)
          if (!isInited) {
            isInited = true
            clEditorSvc.restoreScrollPosition()
          }
        })
        scope.$watch('editorLayoutSvc.isEditorOpen', function (isOpen) {
          clEditorSvc.cledit.toggleEditable(isOpen)
        })

        function onPreviewRefreshed (refreshed) {
          if (refreshed && !clEditorSvc.lastSectionMeasured) {
            clEditorSvc.measureSectionDimensions()
          } else {
            debouncedMeasureSectionDimension()
          }
        }

        var debouncedMeasureSectionDimension = $window.cledit.Utils.debounce(function () {
          if (!isDestroyed()) {
            clEditorSvc.measureSectionDimensions()
            scope.$apply()
          }
        }, 500)
        scope.$watch('editorSvc.lastRefreshPreview', onPreviewRefreshed)
        scope.$watchGroup(['editorSvc.editorElt.clientWidth', 'editorSvc.editorElt.clientHeight', 'editorSvc.previewElt.clientWidth', 'editorSvc.previewElt.clientHeight'], debouncedMeasureSectionDimension)
        scope.$watch('editorLayoutSvc.isPreviewVisible', function (isVisible) {
          isVisible && state && clEditorSvc.measureSectionDimensions()
        })
        scope.$watch('editorLayoutSvc.currentControl', function (currentControl) {
          !currentControl && setTimeout(function () {
            !scope.isDialogOpen && clEditorSvc.cledit && clEditorSvc.cledit.focus()
          }, 1)
        })
      }
    })
  .directive('clPreview',
    function ($window, $templateCache, clEditorSvc, clConfig) {
      var appUri = clConfig.appUri || ''

      return {
        restrict: 'E',
        template: $templateCache.get('core/editor/preview.html'), // Prevent from template loading to be async
        link: link
      }

      function link (scope, element) {
        clEditorSvc.setPreviewElt(element[0].querySelector('.preview__inner'))
        var previewElt = element[0].querySelector('.preview')
        clEditorSvc.isPreviewTop = previewElt.scrollTop < 10
        previewElt.addEventListener('scroll', function () {
          var isPreviewTop = previewElt.scrollTop < 10
          if (isPreviewTop !== clEditorSvc.isPreviewTop) {
            clEditorSvc.isPreviewTop = isPreviewTop
            scope.$apply()
          }
        })
        previewElt.addEventListener('click', function (evt) {
          var elt = evt.target
          while (elt !== previewElt) {
            if (elt.href && elt.href.match(/^https?:\/\//) && (!elt.hash || elt.href.slice(0, appUri.length) !== appUri)) {
              evt.preventDefault()
              var wnd = window.open(elt.href, '_blank')
              return wnd.focus()
            }
            elt = elt.parentNode
          }
        })
      }
    })
  .directive('clToc',
    function (clEditorSvc) {
      return {
        restrict: 'E',
        template: '<div class="toc-tab no-select"></div>',
        link: link
      }

      function link (scope, element) {
        var tocElt = element[0].querySelector('.toc-tab')
        clEditorSvc.setTocElt(tocElt)

        var isMousedown
        var scrollerElt = tocElt
        while (scrollerElt && scrollerElt.tagName !== 'MD-TAB-CONTENT') {
          scrollerElt = scrollerElt.parentNode
        }

        function onClick (e) {
          if (!isMousedown) {
            return
          }
          e.preventDefault()
          var y = e.clientY - tocElt.getBoundingClientRect().top

          clEditorSvc.sectionDescList.cl_some(function (sectionDesc) {
            if (y < sectionDesc.tocDimension.endOffset) {
              var posInSection = (y - sectionDesc.tocDimension.startOffset) / (sectionDesc.tocDimension.height || 1)
              var editorScrollTop = sectionDesc.editorDimension.startOffset + sectionDesc.editorDimension.height * posInSection
              clEditorSvc.editorElt.parentNode.scrollTop = editorScrollTop - clEditorSvc.scrollOffset
              var previewScrollTop = sectionDesc.previewDimension.startOffset + sectionDesc.previewDimension.height * posInSection
              clEditorSvc.previewElt.parentNode.scrollTop = previewScrollTop - clEditorSvc.scrollOffset
              return true
            }
          })
        }

        tocElt.addEventListener('mouseup', function () {
          isMousedown = false
        })
        tocElt.addEventListener('mouseleave', function () {
          isMousedown = false
        })
        tocElt.addEventListener('mousedown', function (e) {
          isMousedown = e.which === 1
          onClick(e)
        })
        tocElt.addEventListener('mousemove', function (e) {
          onClick(e)
        })
      }
    })
  .factory('clEditorClassApplier',
    function ($window, clEditorSvc, clRangeWrapper) {
      var savedSelection
      var nextTickCbs = []
      var nextTickExecCbs = $window.cledit.Utils.debounce(function () {
        while (nextTickCbs.length) {
          nextTickCbs.shift()()
        }
        savedSelection && clEditorSvc.cledit.selectionMgr.setSelectionStartEnd(savedSelection.start, savedSelection.end)
        savedSelection = undefined
      })

      function nextTick (cb) {
        nextTickCbs.push(cb)
        nextTickExecCbs()
      }

      function nextTickRestoreSelection () {
        savedSelection = {
          start: clEditorSvc.cledit.selectionMgr.selectionStart,
          end: clEditorSvc.cledit.selectionMgr.selectionEnd
        }
        nextTickExecCbs()
      }

      function EditorClassApplier (classes, offsetGetter, properties) {
        var classGetter,
          lastEltCount,
          elts
        if (typeof classes === 'function') {
          classGetter = classes
          classes = classGetter()
        } else {
          classes = typeof classes === 'string' ? [classes] : classes
        }
        elts = clEditorSvc.editorElt.getElementsByClassName(classes[0])

        function applyClass () {
          var offset = offsetGetter()
          if (!offset || offset.start === offset.end) {
            return
          }
          var range = clEditorSvc.cledit.selectionMgr.createRange(
            Math.min(offset.start, offset.end),
            Math.max(offset.start, offset.end)
          )
          properties = properties || {}
          classes = classGetter ? classGetter() : classes
          properties.className = classes.join(' ')
          clEditorSvc.cledit.watcher.noWatch(function () {
            clRangeWrapper.wrap(range, properties)
          })
          clEditorSvc.cledit.selectionMgr.hasFocus && nextTickRestoreSelection()
          lastEltCount = elts.length
        }

        function removeClass () {
          clEditorSvc.cledit.watcher.noWatch(function () {
            clRangeWrapper.unwrap(elts)
          })
          clEditorSvc.cledit.selectionMgr.hasFocus && nextTickRestoreSelection()
        }

        function restoreClass () {
          if (!elts.length || elts.length !== lastEltCount) {
            removeClass()
            applyClass()
          }
        }

        this.stop = function () {
          clEditorSvc.cledit.off('contentChanged', restoreClass)
          nextTick(removeClass)
        }

        clEditorSvc.cledit.on('contentChanged', restoreClass)
        nextTick(applyClass)
      }

      return function (classes, offsetGetter, properties) {
        return new EditorClassApplier(classes, offsetGetter, properties)
      }
    })
  .factory('clPreviewClassApplier',
    function ($window, clEditorSvc, clRangeWrapper) {
      function PreviewClassApplier (classes, offsetGetter, properties) {
        var classGetter,
          lastEltCount,
          elts,
          timeoutId
        if (typeof classes === 'function') {
          classGetter = classes
          classes = classGetter()
        } else {
          classes = typeof classes === 'string' ? [classes] : classes
        }
        elts = clEditorSvc.previewElt.getElementsByClassName(classes[0])

        function applyClass () {
          timeoutId = undefined
          var offset = offsetGetter()
          if (!offset || offset.start === offset.end) {
            return
          }
          var start = $window.cledit.Utils.findContainer(clEditorSvc.previewElt, Math.min(offset.start, offset.end))
          var end = $window.cledit.Utils.findContainer(clEditorSvc.previewElt, Math.max(offset.start, offset.end))
          var range = $window.document.createRange()
          range.setStart(start.container, start.offsetInContainer)
          range.setEnd(end.container, end.offsetInContainer)
          properties = properties || {}
          classes = classGetter ? classGetter() : classes
          properties.className = classes.join(' ')
          clRangeWrapper.wrap(range, properties)
          lastEltCount = elts.length
        }

        this.remove = function () {
          clearTimeout(timeoutId)
          clRangeWrapper.unwrap(elts)
        }

        this.restore = function () {
          if (!timeoutId && elts.length !== lastEltCount) {
            this.remove()
            applyClass()
          }
        }

        timeoutId = setTimeout(applyClass, 10) // To come after the clEditorClassApplier
      }

      return function (classes, offsetGetter, properties) {
        return new PreviewClassApplier(classes, offsetGetter, properties)
      }
    })
  .factory('clEditorSvc',
    function ($window, $q, $rootScope, clExtensionSvc, clSettingSvc, clEditorLayoutSvc, clHtmlSanitizer, clPagedown, clVersion, clEditorContentSvc, clEditorMarkdownSvc, clMarkdownGrammarSvc) {
      var clEditorSvc = {
        lastExternalChange: 0,
        scrollOffset: 80,
        options: {},
        setOptions: setOptions,
        initPrism: initPrism,
        sectionHighlighter: sectionHighlighter,
        initConverter: initConverter,
        convert: convert,
        refreshPreview: refreshPreview,
        setPreviewElt: setPreviewElt,
        setTocElt: setTocElt,
        setEditorElt: setEditorElt,
        initCledit: initCledit,
        getEditorOffset: getEditorOffset,
        getPreviewOffset: getPreviewOffset,
        measureSectionDimensions: measureSectionDimensions,
        getScrollPosition: getScrollPosition,
        restoreScrollPosition: restoreScrollPosition,
        scrollToAnchor: scrollToAnchor,
        getPandocAst: getPandocAst,
        applyTemplate: applyTemplate,
        getContent: clEditorContentSvc.getContent
      }

      var editorElt, previewElt, tocElt, previewTextStartOffset
      var parsingCtx, conversionCtx,
        tokens

      function setPreviewElt (elt) {
        previewElt = elt
        clEditorSvc.previewElt = elt
      }

      function setTocElt (elt) {
        tocElt = elt
        clEditorSvc.tocElt = elt
      }

      function setEditorElt (elt) {
        editorElt = elt
        clEditorSvc.editorElt = elt
        parsingCtx = undefined
        conversionCtx = undefined
        clEditorSvc.sectionDescList = []
        clEditorSvc.textToPreviewDiffs = undefined
        clEditorSvc.cledit = clEditorContentSvc.createCledit(elt, elt.parentNode)
        clEditorSvc.cledit.on('contentChanged', function (content, diffs, sectionList) {
          parsingCtx.sectionList = sectionList
        })
        clEditorSvc.pagedownEditor = clPagedown({
          input: Object.create(clEditorSvc.cledit)
        })
        clEditorSvc.pagedownEditor.run()
        editorElt.addEventListener('focus', function () {
          if (clEditorLayoutSvc.currentControl === 'menu') {
            clEditorLayoutSvc.currentControl = undefined
          }
        })
      }

      var Prism = $window.Prism
      function sectionHighlighter (section) {
        return Prism.highlight(section.text, clEditorSvc.prismGrammars[section.data])
      }

      function setOptions (options) {
        clEditorSvc.options = options
      }

      function initPrism () {
        if (clEditorSvc.options) {
          var options = ({
            insideFences: clEditorMarkdownSvc.defaultOptions.insideFences
          }).cl_extend(clEditorSvc.options)
          clEditorSvc.prismGrammars = clMarkdownGrammarSvc.makeGrammars(options)
        }
      }

      function initConverter () {
        if (clEditorSvc.options) {
          clEditorSvc.converter = clEditorMarkdownSvc.createConverter(clEditorSvc.options, true)
        }
      }

      function initCledit (reinit) {
        if ($rootScope.currentFile) {
          var options = {
            sectionHighlighter: sectionHighlighter,
            sectionParser: function (text) {
              parsingCtx = clEditorMarkdownSvc.parseSections(clEditorSvc.converter, text)
              return parsingCtx.sections
            }
          }
          clEditorContentSvc.initCledit($rootScope.currentFile.content, options, reinit)
        }
      }

      function convert () {
        conversionCtx = clEditorMarkdownSvc.convert(parsingCtx, conversionCtx)
        tokens = parsingCtx.markdownState.tokens
        clEditorSvc.lastConvert = Date.now()
      }

      var anchorHash = {}

      function refreshPreview () {
        var newSectionDescList = []
        var sectionPreviewElt, sectionTocElt
        var sectionIdx = 0
        var sectionDescIdx = 0
        var insertBeforePreviewElt = previewElt.firstChild
        var insertBeforeTocElt = tocElt.firstChild
        conversionCtx.htmlSectionDiff.cl_each(function (item) {
          for (var i = 0; i < item[1].length; i++) {
            var section = conversionCtx.sectionList[sectionIdx]
            if (item[0] === 0) {
              var sectionDesc = clEditorSvc.sectionDescList[sectionDescIdx++]
              sectionDesc.editorElt = section.elt
              newSectionDescList.push(sectionDesc)
              sectionIdx++
              insertBeforePreviewElt.classList.remove('modified')
              insertBeforePreviewElt = insertBeforePreviewElt.nextSibling
              insertBeforeTocElt.classList.remove('modified')
              insertBeforeTocElt = insertBeforeTocElt.nextSibling
            } else if (item[0] === -1) {
              sectionDescIdx++
              sectionPreviewElt = insertBeforePreviewElt
              insertBeforePreviewElt = insertBeforePreviewElt.nextSibling
              previewElt.removeChild(sectionPreviewElt)
              sectionTocElt = insertBeforeTocElt
              insertBeforeTocElt = insertBeforeTocElt.nextSibling
              tocElt.removeChild(sectionTocElt)
            } else if (item[0] === 1) {
              var html = conversionCtx.htmlSectionList[sectionIdx++]

              // Create preview section element
              sectionPreviewElt = document.createElement('div')
              sectionPreviewElt.className = 'cl-preview-section modified'
              sectionPreviewElt.innerHTML = clHtmlSanitizer(html)
              if (insertBeforePreviewElt) {
                previewElt.insertBefore(sectionPreviewElt, insertBeforePreviewElt)
              } else {
                previewElt.appendChild(sectionPreviewElt)
              }
              clExtensionSvc.sectionPreview(sectionPreviewElt, clEditorSvc.options)

              // Create TOC section element
              sectionTocElt = document.createElement('div')
              sectionTocElt.className = 'cl-toc-section modified'
              var headingElt = sectionPreviewElt.querySelector('h1, h2, h3, h4, h5, h6')
              if (headingElt) {
                headingElt = headingElt.cloneNode(true)
                headingElt.removeAttribute('id')
                sectionTocElt.appendChild(headingElt)
              }
              if (insertBeforeTocElt) {
                tocElt.insertBefore(sectionTocElt, insertBeforeTocElt)
              } else {
                tocElt.appendChild(sectionTocElt)
              }

              newSectionDescList.push({
                section: section,
                editorElt: section.elt,
                previewElt: sectionPreviewElt,
                tocElt: sectionTocElt
              })
            }
          }
        })
        clEditorSvc.sectionDescList = newSectionDescList
        tocElt.classList[tocElt.querySelector('.cl-toc-section *') ? 'remove' : 'add']('toc-tab--empty')
        runAsyncPreview()
      }

      function runAsyncPreview () {
        var imgLoadingPromises = previewElt.querySelectorAll('.cl-preview-section.modified img').cl_map(function (imgElt) {
          return new Promise(function (resolve) {
            if (!imgElt.src) {
              return resolve()
            }
            var img = new $window.Image()
            img.onload = resolve
            img.onerror = resolve
            img.src = imgElt.src
          })
        })
        Promise.all(imgLoadingPromises.concat(clExtensionSvc.asyncPreview(clEditorSvc.options)))
          .then(function () {
            var html = previewElt.querySelectorAll('.cl-preview-section').cl_reduce(function (html, elt) {
              if (!elt.portableHtml) {
                var clonedElt = elt.cloneNode(true)
                // Removed rendered Math, keep only original tex
                clonedElt.querySelectorAll('[class^=MathJax]').cl_each(function (elt) {
                  elt.parentNode.removeChild(elt)
                })
                // Unwrap tables
                clonedElt.querySelectorAll('.table-wrapper').cl_each(function (elt) {
                  while (elt.firstChild) {
                    elt.parentNode.appendChild(elt.firstChild)
                  }
                  elt.parentNode.removeChild(elt)
                })
                elt.portableHtml = clonedElt.innerHTML
              }
              return html + elt.portableHtml
            }, '')
            clEditorSvc.previewHtml = html.replace(/^\s+|\s+$/g, '')
            clEditorSvc.previewText = previewElt.textContent
            clEditorSvc.lastRefreshPreview = Date.now()
            debouncedTextToPreviewDiffs()
            $rootScope.$apply()
          })
      }

      var diffMatchPatch = new $window.diff_match_patch() // eslint-disable-line new-cap
      var debouncedTextToPreviewDiffs = $window.cledit.Utils.debounce(function () {
        previewTextStartOffset = 0
        clEditorSvc.sectionDescList.cl_each(function (sectionDesc) {
          if (!sectionDesc.textToPreviewDiffs) {
            sectionDesc.previewText = sectionDesc.previewElt.textContent
            sectionDesc.textToPreviewDiffs = diffMatchPatch.diff_main(sectionDesc.section.text, sectionDesc.previewText)
          }
        })
        clEditorSvc.lastTextToPreviewDiffs = Date.now()
        $rootScope.$apply()
      }, 50)

      function getPreviewOffset (textOffset) {
        var previewOffset = previewTextStartOffset
        clEditorSvc.sectionDescList.cl_some(function (sectionDesc) {
          if (!sectionDesc.textToPreviewDiffs) {
            previewOffset = undefined
            return true
          }
          if (sectionDesc.section.text.length >= textOffset) {
            previewOffset += diffMatchPatch.diff_xIndex(sectionDesc.textToPreviewDiffs, textOffset)
            return true
          }
          textOffset -= sectionDesc.section.text.length
          previewOffset += sectionDesc.previewText.length
        })
        return previewOffset
      }

      function getEditorOffset (previewOffset) {
        previewOffset -= previewTextStartOffset
        var editorOffset = 0
        clEditorSvc.sectionDescList.cl_some(function (sectionDesc) {
          if (!sectionDesc.textToPreviewDiffs) {
            editorOffset = undefined
            return true
          }
          if (sectionDesc.previewText.length >= previewOffset) {
            var previewToTextDiffs = sectionDesc.textToPreviewDiffs.cl_map(function (diff) {
              return [-diff[0], diff[1]]
            })
            editorOffset += diffMatchPatch.diff_xIndex(previewToTextDiffs, previewOffset)
            return true
          }
          previewOffset -= sectionDesc.previewText.length
          editorOffset += sectionDesc.section.text.length
        })
        return editorOffset
      }

      var saveSelection = $window.cledit.Utils.debounce(function () {
        var selection = $window.getSelection()
        var range = selection.rangeCount && selection.getRangeAt(0)
        if (range) {
          if (!clEditorSvc.previewElt ||
            !(clEditorSvc.previewElt.compareDocumentPosition(range.startContainer) & $window.Node.DOCUMENT_POSITION_CONTAINED_BY) ||
            !(clEditorSvc.previewElt.compareDocumentPosition(range.endContainer) & $window.Node.DOCUMENT_POSITION_CONTAINED_BY)
          ) {
            range = undefined
          }
        }
        if (clEditorSvc.previewSelectionRange !== range) {
          clEditorSvc.previewSelectionRange = range
          clEditorSvc.previewSelectionStartOffset = undefined
          clEditorSvc.previewSelectionEndOffset = undefined
          if (range) {
            var startRange = document.createRange()
            startRange.setStart(previewElt, 0)
            startRange.setEnd(range.startContainer, range.startOffset)
            clEditorSvc.previewSelectionStartOffset = ('' + startRange.toString()).length
            clEditorSvc.previewSelectionEndOffset = clEditorSvc.previewSelectionStartOffset + ('' + range.toString()).length
            var editorStartOffset = clEditorSvc.getEditorOffset(clEditorSvc.previewSelectionStartOffset)
            var editorEndOffset = clEditorSvc.getEditorOffset(clEditorSvc.previewSelectionEndOffset)
            if (editorStartOffset !== undefined && editorEndOffset !== undefined) {
              clEditorSvc.cledit.selectionMgr.setSelectionStartEnd(editorStartOffset, editorEndOffset, false)
            }
          }
          $rootScope.$apply()
        }
      }, 50)

      $window.addEventListener('keyup', saveSelection)
      $window.addEventListener('mouseup', saveSelection)
      $window.addEventListener('contextmenu', saveSelection)

      function SectionDimension (startOffset, endOffset) {
        this.startOffset = startOffset
        this.endOffset = endOffset
        this.height = endOffset - startOffset
      }

      function dimensionNormalizer (dimensionName) {
        return function () {
          var dimensionList = clEditorSvc.sectionDescList.cl_map(function (sectionDesc) {
            return sectionDesc[dimensionName]
          })
          var dimension, i, j
          for (i = 0; i < dimensionList.length; i++) {
            dimension = dimensionList[i]
            if (!dimension.height) {
              continue
            }
            for (j = i + 1; j < dimensionList.length && dimensionList[j].height === 0; j++) {
            }
            var normalizeFactor = j - i
            if (normalizeFactor === 1) {
              continue
            }
            var normalizedHeight = dimension.height / normalizeFactor
            dimension.height = normalizedHeight
            dimension.endOffset = dimension.startOffset + dimension.height
            for (j = i + 1; j < i + normalizeFactor; j++) {
              var startOffset = dimension.endOffset
              dimension = dimensionList[j]
              dimension.startOffset = startOffset
              dimension.height = normalizedHeight
              dimension.endOffset = dimension.startOffset + dimension.height
            }
            i = j - 1
          }
        }
      }

      var normalizeEditorDimensions = dimensionNormalizer('editorDimension')
      var normalizePreviewDimensions = dimensionNormalizer('previewDimension')
      var normalizeTocDimensions = dimensionNormalizer('tocDimension')

      function measureSectionDimensions () {
        var editorSectionOffset = 0
        var previewSectionOffset = 0
        var tocSectionOffset = 0
        var sectionDesc = clEditorSvc.sectionDescList[0]
        var nextSectionDesc
        for (var i = 1; i < clEditorSvc.sectionDescList.length; i++) {
          nextSectionDesc = clEditorSvc.sectionDescList[i]

          // Measure editor section
          var newEditorSectionOffset = nextSectionDesc.editorElt ? nextSectionDesc.editorElt.offsetTop : editorSectionOffset
          newEditorSectionOffset = newEditorSectionOffset > editorSectionOffset ? newEditorSectionOffset : editorSectionOffset
          sectionDesc.editorDimension = new SectionDimension(editorSectionOffset, newEditorSectionOffset)
          editorSectionOffset = newEditorSectionOffset

          // Measure preview section
          var newPreviewSectionOffset = nextSectionDesc.previewElt ? nextSectionDesc.previewElt.offsetTop : previewSectionOffset
          newPreviewSectionOffset = newPreviewSectionOffset > previewSectionOffset ? newPreviewSectionOffset : previewSectionOffset
          sectionDesc.previewDimension = new SectionDimension(previewSectionOffset, newPreviewSectionOffset)
          previewSectionOffset = newPreviewSectionOffset

          // Measure TOC section
          var newTocSectionOffset = nextSectionDesc.tocElt ? nextSectionDesc.tocElt.offsetTop + nextSectionDesc.tocElt.offsetHeight / 2 : tocSectionOffset
          newTocSectionOffset = newTocSectionOffset > tocSectionOffset ? newTocSectionOffset : tocSectionOffset
          sectionDesc.tocDimension = new SectionDimension(tocSectionOffset, newTocSectionOffset)
          tocSectionOffset = newTocSectionOffset

          sectionDesc = nextSectionDesc
        }

        // Last section
        sectionDesc = clEditorSvc.sectionDescList[i - 1]
        if (sectionDesc) {
          sectionDesc.editorDimension = new SectionDimension(editorSectionOffset, editorElt.scrollHeight)
          sectionDesc.previewDimension = new SectionDimension(previewSectionOffset, previewElt.scrollHeight)
          sectionDesc.tocDimension = new SectionDimension(tocSectionOffset, tocElt.scrollHeight)
        }

        normalizeEditorDimensions()
        normalizePreviewDimensions()
        normalizeTocDimensions()

        clEditorSvc.lastSectionMeasured = Date.now()
        clEditorSvc.lastSectionDescListMeasured = clEditorSvc.sectionDescList
      }

      function getObjectToScroll () {
        var elt = clEditorSvc.editorElt.parentNode
        var dimensionKey = 'editorDimension'
        if (!clEditorLayoutSvc.isEditorOpen) {
          elt = clEditorSvc.previewElt.parentNode
          dimensionKey = 'previewDimension'
        }
        return {
          elt: elt,
          dimensionKey: dimensionKey
        }
      }

      function getScrollPosition () {
        var objToScroll = getObjectToScroll()
        var scrollTop = objToScroll.elt.scrollTop
        var result
        if (clEditorSvc.lastSectionDescListMeasured) {
          clEditorSvc.lastSectionDescListMeasured.cl_some(function (sectionDesc, idx) {
            if (scrollTop < sectionDesc[objToScroll.dimensionKey].endOffset) {
              result = {
                sectionIdx: idx,
                posInSection: (scrollTop - sectionDesc[objToScroll.dimensionKey].startOffset) / (sectionDesc[objToScroll.dimensionKey].height || 1)
              }
              return true
            }
          })
        }
        return result
      }

      function restoreScrollPosition () {
        var scrollPosition = $rootScope.currentFile.content.state.scrollPosition
        if (scrollPosition && clEditorSvc.lastSectionDescListMeasured) {
          var objToScroll = getObjectToScroll()
          var sectionDesc = clEditorSvc.lastSectionDescListMeasured[scrollPosition.sectionIdx]
          if (sectionDesc) {
            var scrollTop = sectionDesc[objToScroll.dimensionKey].startOffset + sectionDesc[objToScroll.dimensionKey].height * scrollPosition.posInSection
            objToScroll.elt.scrollTop = scrollTop
          }
        }
      }

      function scrollToAnchor (anchor) {
        var scrollTop = 0
        var scrollerElt = clEditorSvc.previewElt.parentNode
        var sectionDesc = anchorHash[anchor]
        if (sectionDesc) {
          if (clEditorLayoutSvc.isPreviewVisible) {
            scrollTop = sectionDesc.previewDimension.startOffset - clEditorLayoutSvc.navbarElt.offsetHeight
          } else {
            scrollTop = sectionDesc.editorDimension.startOffset - clEditorSvc.scrollOffset
            scrollerElt = clEditorSvc.editorElt.parentNode
          }
        } else {
          var elt = document.getElementById(anchor)
          if (elt) {
            scrollTop = elt.offsetTop - clEditorLayoutSvc.navbarElt.offsetHeight
          }
        }
        var maxScrollTop = scrollerElt.scrollHeight - scrollerElt.offsetHeight
        if (scrollTop < 0) {
          scrollTop = 0
        } else if (scrollTop > maxScrollTop) {
          scrollTop = maxScrollTop
        }
        scrollerElt.clanim.scrollTop(scrollTop).duration(360).easing('materialOut').start()
      }

      function getPandocAst () {
        return tokens && $window.markdownitPandocRenderer(tokens, clEditorSvc.converter.options)
      }

      function applyTemplate (template) {
        var view = {
          file: {
            name: $rootScope.currentFile.name,
            content: {
              properties: $rootScope.currentFile.content.properties,
              text: $rootScope.currentFile.content.text,
              html: clEditorSvc.previewHtml
            }
          }
        }
        var worker = new $window.Worker(clVersion.getAssetPath('templateWorker-min.js'))
        worker.postMessage([template, view, clSettingSvc.values.handlebarsHelpers])
        return $q(function (resolve, reject) {
          worker.addEventListener('message', function (e) {
            resolve(e.data.toString())
          })
          setTimeout(function () {
            worker.terminate()
            reject('Template generation timeout.')
          }, 10000)
        })
      }

      return clEditorSvc
    })
  .run(
    function ($window, $rootScope, $location, $route, clEditorSvc) {
      var lastSectionMeasured = clEditorSvc.lastSectionMeasured
      var unwatch = $rootScope.$watch('editorSvc.lastSectionMeasured', function (value) {
        var hash = $location.hash()
        if (hash && value !== lastSectionMeasured) {
          clEditorSvc.scrollToAnchor(hash)
          unwatch()
        }
      })

      $rootScope.$on('$locationChangeStart', function (evt, urlAfter, urlBefore) {
        if (urlBefore !== urlAfter) {
          var splitUrl = urlAfter.split('#')
          if (splitUrl.length === 3) {
            var hash = decodeURIComponent(splitUrl[2])
            var hashPos = splitUrl[0].length + splitUrl[1].length
            if (urlBefore.slice(0, hashPos) === urlAfter.slice(0, hashPos)) {
              evt.preventDefault()
              clEditorSvc.scrollToAnchor(hash)
            }
          }
        }
      })
    })
