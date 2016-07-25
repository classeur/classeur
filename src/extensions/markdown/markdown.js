angular.module('classeur.extensions.markdown', [])
  .run(function ($window, clExtensionSvc) {
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

    clExtensionSvc.onGetOptions(function (options, properties) {
      options.abbr = properties['ext:markdown:abbr'] !== 'false'
      options.breaks = properties['ext:markdown:breaks'] !== 'false'
      options.deflist = properties['ext:markdown:deflist'] !== 'false'
      options.del = properties['ext:markdown:del'] !== 'false'
      options.fence = properties['ext:markdown:fence'] !== 'false'
      options.footnote = properties['ext:markdown:footnote'] !== 'false'
      options.linkify = properties['ext:markdown:linkify'] !== 'false'
      options.sub = properties['ext:markdown:sub'] !== 'false'
      options.sup = properties['ext:markdown:sup'] !== 'false'
      options.table = properties['ext:markdown:table'] !== 'false'
      options.typographer = properties['ext:markdown:typographer'] !== 'false'
    })

    clExtensionSvc.onInitConverter(0, function (markdown, options) {
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

      // Wrap tables into a div for scrolling
      markdown.renderer.rules.table_open = function (tokens, idx, options) {
        return '<div class="table-wrapper">' + markdown.renderer.renderToken(tokens, idx, options)
      }
      markdown.renderer.rules.table_close = function (tokens, idx, options) {
        return markdown.renderer.renderToken(tokens, idx, options) + '</div>'
      }

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

      markdown.renderer.rules.footnote_ref = function (tokens, idx) {
        var n = Number(tokens[idx].meta.id + 1).toString()
        var id = 'fnref' + n
        if (tokens[idx].meta.subId > 0) {
          id += ':' + tokens[idx].meta.subId
        }
        return '<sup class="footnote-ref"><a href="#fn' + n + '" id="' + id + '">' + n + '</a></sup>'
      }
    })

    clExtensionSvc.onSectionPreview(function (elt) {
      elt.querySelectorAll('.prism').cl_each(function (elt) {
        !elt.highlighted && $window.Prism.highlightElement(elt)
        elt.highlighted = true
      })
    })
  })
