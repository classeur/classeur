angular.module('classeur.extensions.markdown', [])
  .directive('clMarkdown',
    function ($window, clEditorSvc) {
      var options = {}
      var coreBaseRules = [
        'normalize',
        'block',
        'inline',
        'linkify',
        'replacements',
        'smartquotes'
      ]
      var blockBaseRules = [
        'code',
        'fence',
        'blockquote',
        'hr',
        'list',
        'reference',
        'heading',
        'lheading',
        'html_block',
        'table',
        'paragraph'
      ]
      var inlineBaseRules = [
        'text',
        'newline',
        'escape',
        'backticks',
        'strikethrough',
        'emphasis',
        'link',
        'image',
        'autolink',
        'html_inline',
        'entity'
      ]
      var inlineBaseRules2 = [
        'balance_pairs',
        'strikethrough',
        'emphasis',
        'text_collapse'
      ]

      clEditorSvc.onMarkdownInit(0, function (markdown) {
        markdown.set({
          html: true,
          breaks: !!options.breaks,
          linkify: !!options.linkify,
          typographer: !!options.typographer,
          langPrefix: 'prism language-'
        })

        markdown.core.ruler.enable(coreBaseRules)

        var blockRules = blockBaseRules.slice()
        !options.fence && blockRules.splice(blockRules.indexOf('fence'), 1)
        !options.table && blockRules.splice(blockRules.indexOf('table'), 1)
        markdown.block.ruler.enable(blockRules)

        var inlineRules = inlineBaseRules.slice()
        var inlineRules2 = inlineBaseRules2.slice()
        if (!options.del) {
          inlineRules.splice(blockRules.indexOf('strikethrough'), 1)
          inlineRules2.splice(blockRules.indexOf('strikethrough'), 1)
        }
        markdown.inline.ruler.enable(inlineRules)
        markdown.inline.ruler2.enable(inlineRules2)

        options.abbr && markdown.use($window.markdownitAbbr)
        options.deflist && markdown.use($window.markdownitDeflist)
        options.footnote && markdown.use($window.markdownitFootnote)
        options.sub && markdown.use($window.markdownitSub)
        options.sup && markdown.use($window.markdownitSup)

        markdown.core.ruler.before('replacements', 'anchors', function (state) {
          var anchorHash = {}
          var headingOpenToken, headingContent
          state.tokens.cl_each(function (token) {
            if (token.type === 'heading_open') {
              headingContent = ''
              headingOpenToken = token
            } else if (token.type === 'heading_close') {
              headingOpenToken.headingContent = headingContent

              // Slugify according to http://pandoc.org/README.html#extension-auto_identifiers
              var slug = headingContent
                .replace(/\s/g, '-') // Replace all spaces and newlines with hyphens
                .replace(/[\0-,\/:-@[-^`{-~]/g, '') // Remove all punctuation, except underscores, hyphens, and periods
                .toLowerCase() // Convert all alphabetic characters to lowercase

              // Remove everything up to the first letter
              for (var i = 0; i < slug.length; i++) {
                var charCode = slug.charCodeAt(i)
                if ((charCode >= 0x61 && charCode <= 0x7A) || charCode > 0x7E) {
                  break
                }
              }

              // If nothing is left after this, use the identifier `section`
              slug = slug.slice(i) || 'section'

              var anchor = slug
              var index = 1
              while (anchorHash.hasOwnProperty(anchor)) {
                anchor = slug + '-' + (index++)
              }
              anchorHash[anchor] = true
              headingOpenToken.headingAnchor = anchor
              headingOpenToken.attrs = [
                ['id', anchor]
              ]
              headingOpenToken = undefined
            } else if (headingOpenToken) {
              headingContent += token.children.cl_reduce(function (result, child) {
                if (child.type !== 'footnote_ref') {
                  result += child.content
                }
                return result
              }, '')
            }
          })
        })

        // Transform style into align attribute to pass the HTML sanitizer
        var textAlignLength = 'text-align:'.length
        markdown.renderer.rules.th_open = markdown.renderer.rules.td_open = function (tokens, idx, options) {
          var token = tokens[idx]
          if (token.attrs && token.attrs.length && token.attrs[0][0] === 'style') {
            token.attrs = [
              ['align', token.attrs[0][1].slice(textAlignLength)]
            ]
          }
          return markdown.renderer.renderToken(tokens, idx, options)
        }

        options.toc && markdown.block.ruler.before('paragraph', 'toc', function (state, startLine, endLine, silent) {
          var pos = state.bMarks[startLine] + state.tShift[startLine]
          var max = state.eMarks[startLine]
          if (
            max - pos !== 5 ||
            state.src.charCodeAt(pos) !== 0x5B /* [ */ ||
            state.src.charCodeAt(pos + 4) !== 0x5D /* ] */ ||
            state.src.slice(pos + 1, pos + 4).toLowerCase() !== 'toc'
          ) {
            return false
          }
          if (silent) {
            return true
          }
          state.line = startLine + 1
          state.tokens.push({
            type: 'toc',
            level: state.level,
            map: [startLine, endLine]
          })
          return true
        })

        function TocItem (level, anchor, text) {
          this.level = level
          this.anchor = anchor
          this.text = text
          this.children = []
        }

        TocItem.prototype.toString = function () {
          var result = '<li>'
          if (this.anchor && this.text) {
            result += '<a href="#' + this.anchor + '">' + this.text + '</a>'
          }
          if (this.children.length !== 0) {
            result += '<ul>' + this.children
                .cl_map(function (item) {
                  return item.toString()
                }).join('') + '</ul>'
          }
          return result + '</li>'
        }

        // Transform a flat list of TocItems into a tree
        function groupTocItems (array, level) {
          level = level || 1
          var result = []
          var currentItem

          function pushCurrentItem () {
            if (currentItem.children.length > 0) {
              currentItem.children = groupTocItems(currentItem.children, level + 1)
            }
            result.push(currentItem)
          }
          array.cl_each(function (item) {
            if (item.level !== level) {
              if (level !== options.tocDepth) {
                currentItem = currentItem || new TocItem()
                currentItem.children.push(item)
              }
            } else {
              currentItem && pushCurrentItem()
              currentItem = item
            }
          })
          currentItem && pushCurrentItem()
          return result
        }

        options.toc && markdown.core.ruler.push('toc_builder', function (state) {
          var tocContent
          state.tokens.cl_each(function (token) {
            if (token.type === 'toc') {
              if (!tocContent) {
                var tocItems = []
                state.tokens.cl_each(function (token) {
                  token.headingAnchor && tocItems.push(new TocItem(
                    token.tag.charCodeAt(1) - 0x30,
                    token.headingAnchor,
                    token.headingContent
                  ))
                })
                tocItems = groupTocItems(tocItems)
                tocContent = '<div class="toc">'
                if (tocItems.length) {
                  tocContent += '<ul>' + tocItems
                      .cl_map(function (item) {
                        return item.toString()
                      }).join('') + '</ul>'
                }
                tocContent += '</div>'
              }
              token.content = tocContent
              token.type = 'html_block'
            }
          })
        })

        markdown.renderer.rules.footnote_ref = function (tokens, idx) {
          var n = Number(tokens[idx].meta.id + 1).toString()
          var id = 'fnref' + n
          if (tokens[idx].meta.subId > 0) {
            id += ':' + tokens[idx].meta.subId
          }
          return '<sup class="footnote-ref"><a href="#fn' + n + '" id="' + id + '">' + n + '</a></sup>'
        }

        clEditorSvc.setPrismOptions({
          fences: options.fence,
          tables: options.table,
          footnotes: options.footnote,
          abbrs: options.abbr,
          deflists: options.deflist,
          dels: options.del,
          subs: options.sub,
          sups: options.sup,
          tocs: options.toc
        })

        clEditorSvc.onAsyncPreview(function (cb) {
          clEditorSvc.previewElt.querySelectorAll('.prism').cl_each(function (elt) {
            !elt.highlighted && $window.Prism.highlightElement(elt)
            elt.highlighted = true
          })
          cb()
        })
      })

      return {
        restrict: 'A',
        link: link
      }

      function link (scope) {
        function checkOptions () {
          var fileProperties = scope.currentFile.content.properties
          var tocDepth = parseInt(fileProperties['ext:markdown:tocdepth'], 10)
          var newOptions = {
            abbr: fileProperties['ext:markdown:abbr'] !== 'false',
            breaks: fileProperties['ext:markdown:breaks'] !== 'false',
            deflist: fileProperties['ext:markdown:deflist'] !== 'false',
            del: fileProperties['ext:markdown:del'] !== 'false',
            fence: fileProperties['ext:markdown:fence'] !== 'false',
            footnote: fileProperties['ext:markdown:footnote'] !== 'false',
            linkify: fileProperties['ext:markdown:linkify'] !== 'false',
            sub: fileProperties['ext:markdown:sub'] !== 'false',
            sup: fileProperties['ext:markdown:sup'] !== 'false',
            table: fileProperties['ext:markdown:table'] !== 'false',
            typographer: fileProperties['ext:markdown:typographer'] !== 'false',
            toc: fileProperties['ext:markdown:toc'] !== 'false',
            tocDepth: isNaN(tocDepth) ? 6 : tocDepth
          }
          if (JSON.stringify(newOptions) !== JSON.stringify(options)) {
            options = newOptions
            return true
          }
        }

        checkOptions()
        scope.$watch('currentFile.content.properties', function (properties) {
          if (properties && checkOptions()) {
            clEditorSvc.initConverter()
          }
        })
      }
    })
