angular.module('classeur.core.editorMarkdown', [])
  .filter('clHighlightMarkdown',
    function ($window, $sce, clEditorMarkdownSvc) {
      return function (value, converter, grammars) {
        converter = converter || clEditorMarkdownSvc.defaultConverter
        grammars = grammars || clEditorMarkdownSvc.defaultPrismGrammars
        var parsingCtx = clEditorMarkdownSvc.parseSections(converter, value)
        var html = parsingCtx.sections.cl_map(function (section) {
          return $window.Prism.highlight(section.text, grammars[section.data])
        }).join('')
        return $sce.trustAsHtml(html)
      }
    })
  .filter('clConvertMarkdown',
    function ($sce, clEditorSvc, clHtmlSanitizer) {
      return function (value) {
        return $sce.trustAsHtml(clHtmlSanitizer(clEditorSvc.converter.render(value || '')))
      }
    })
  .factory('clEditorMarkdownSvc', function ($window, clMarkdownGrammarSvc, clExtensionSvc) {
    var clEditorMarkdownSvc = {
      createConverter: createConverter,
      parseSections: parseSections,
      convert: convert
    }

    var htmlSectionMarker = '\uF111\uF222\uF333\uF444'
    var diffMatchPatch = new $window.diff_match_patch() // eslint-disable-line new-cap

    // Create aliases for syntax highlighting
    var Prism = $window.Prism
    ;({
      'js': 'javascript',
      'json': 'javascript',
      'html': 'markup',
      'svg': 'markup',
      'xml': 'markup',
      'py': 'python',
      'rb': 'ruby',
      'ps1': 'powershell',
      'psm1': 'powershell'
    }).cl_each(function (name, alias) {
      Prism.languages[alias] = Prism.languages[name]
    })

    var insideFences = {}
    Prism.languages.cl_each(function (language, name) {
      if (Prism.util.type(language) === 'Object') {
        insideFences['language-' + name] = {
          pattern: new RegExp('(```|~~~)' + name + '\\W[\\s\\S]*'),
          inside: {
            'cl cl-pre': /(```|~~~).*/,
            rest: language
          }
        }
      }
    })

    var noSpellcheckTokens = [
      'code',
      'pre',
      'pre gfm',
      'math block',
      'math inline',
      'math expr block',
      'math expr inline',
      'latex block'
    ].cl_reduce(function (noSpellcheckTokens, key) {
      noSpellcheckTokens[key] = true
      return noSpellcheckTokens
    }, Object.create(null))
    Prism.hooks.add('wrap', function (env) {
      if (noSpellcheckTokens[env.type]) {
        env.attributes.spellcheck = 'false'
      }
    })

    function flagHash (arr) {
      return arr.cl_reduce(function (map, type) {
        map[type] = true
        return map
      }, Object.create(null))
    }
    var startSectionBlockTypes = [
      'paragraph_open',
      'blockquote_open',
      'heading_open',
      'code',
      'fence',
      'table_open',
      'html_block',
      'bullet_list_open',
      'ordered_list_open',
      'hr',
      'dl_open'
    ]
    var startSectionBlockTypeMap = flagHash(startSectionBlockTypes)
    var listBlockTypeMap = flagHash([
      'bullet_list_open',
      'ordered_list_open'
    ])
    var blockquoteBlockTypeMap = flagHash([
      'blockquote_open'
    ])
    var tableBlockTypeMap = flagHash([
      'table_open'
    ])
    var deflistBlockTypeMap = flagHash([
      'dl_open'
    ])

    clEditorMarkdownSvc.defaultOptions = {
      fence: true,
      table: true,
      footnote: true,
      abbr: true,
      del: true,
      sub: true,
      sup: true,
      math: true,
      insideFences: insideFences
    }
    clEditorMarkdownSvc.defaultConverter = createConverter(clEditorMarkdownSvc.defaultOptions)
    clEditorMarkdownSvc.defaultPrismGrammars = clMarkdownGrammarSvc.makeGrammars(clEditorMarkdownSvc.defaultOptions)

    function createConverter (options, isCurrentFile) {
      // Let the listeners add the rules
      var converter = new $window.markdownit('zero') // eslint-disable-line new-cap
      converter.core.ruler.enable([], true)
      converter.block.ruler.enable([], true)
      converter.inline.ruler.enable([], true)
      clExtensionSvc.initConverter(converter, options, isCurrentFile)
      startSectionBlockTypes.cl_each(function (type) {
        var rule = converter.renderer.rules[type] || converter.renderer.renderToken
        converter.renderer.rules[type] = function (tokens, idx) {
          if (tokens[idx].sectionDelimiter) {
            // Add section delimiter
            return htmlSectionMarker + rule.apply(converter.renderer, arguments)
          }
          return rule.apply(converter.renderer, arguments)
        }
      })
      return converter
    }

    function parseSections (converter, text) {
      var markdownState = new converter.core.State(text, converter, {})
      var markdownCoreRules = converter.core.ruler.getRules('')
      markdownCoreRules[0](markdownState) // Pass the normalize rule
      markdownCoreRules[1](markdownState) // Pass the block rule
      var lines = text.split('\n')
      lines.pop() // Assume last char is a '\n'
      var data = 'main'
      var i = 0
      var parsingCtx = {
        sections: [],
        converter: converter,
        markdownState: markdownState,
        markdownCoreRules: markdownCoreRules
      }

      function addSection (maxLine) {
        var section = {
          text: '',
          data: data
        }
        for (; i < maxLine; i++) {
          section.text += lines[i] + '\n'
        }
        section && parsingCtx.sections.push(section)
      }
      markdownState.tokens.cl_each(function (token, index) {
        // index === 0 means there are empty lines at the begining of the file
        if (token.level === 0 && startSectionBlockTypeMap[token.type]) {
          if (index > 0) {
            token.sectionDelimiter = true
            addSection(token.map[0])
          }
          if (listBlockTypeMap[token.type]) {
            data = 'list'
          } else if (blockquoteBlockTypeMap[token.type]) {
            data = 'blockquote'
          } else if (tableBlockTypeMap[token.type]) {
            data = 'table'
          } else if (deflistBlockTypeMap[token.type]) {
            data = 'deflist'
          } else {
            data = 'main'
          }
        }
      })
      addSection(lines.length)
      return parsingCtx
    }

    function hashArray (arr, valueHash, valueArray) {
      var hash = []
      arr.cl_each(function (str) {
        var strHash = valueHash[str]
        if (strHash === undefined) {
          strHash = valueArray.length
          valueArray.push(str)
          valueHash[str] = strHash
        }
        hash.push(strHash)
      })
      return String.fromCharCode.apply(null, hash)
    }

    function convert (parsingCtx, oldConversionCtx) {
      if (!parsingCtx.markdownState.isConverted) { // Convert can be called twice without editor modification
        parsingCtx.markdownCoreRules.slice(2).cl_each(function (rule) { // Skip previously passed rules
          rule(parsingCtx.markdownState)
        })
        parsingCtx.markdownState.isConverted = true
      }
      var tokens = parsingCtx.markdownState.tokens
      var html = parsingCtx.converter.renderer.render(
        tokens,
        parsingCtx.converter.options,
        parsingCtx.markdownState.env
      )
      var htmlSectionList = html.split(htmlSectionMarker)
      htmlSectionList[0] === '' && htmlSectionList.shift()
      var valueHash = Object.create(null)
      var valueArray = []
      var newSectionHash = hashArray(htmlSectionList, valueHash, valueArray)
      var htmlSectionDiff = [
        [1, newSectionHash]
      ]
      if (oldConversionCtx) {
        var oldSectionHash = hashArray(oldConversionCtx.htmlSectionList, valueHash, valueArray)
        htmlSectionDiff = diffMatchPatch.diff_main(oldSectionHash, newSectionHash, false)
      }
      return {
        sectionList: parsingCtx.sectionList,
        htmlSectionList: htmlSectionList,
        htmlSectionDiff: htmlSectionDiff
      }
    }

    return clEditorMarkdownSvc
  })
  .factory('clMarkdownGrammarSvc', function () {
    var clMarkdownGrammarSvc = {
      makeGrammars: makeGrammars
    }

    var charInsideUrl = '(&|[-A-Z0-9+@#/%?=~_|[\\]()!:,.;])'
    var charEndingUrl = '(&|[-A-Z0-9+@#/%=~_|[\\])])'
    var urlPattern = new RegExp('(https?|ftp)(://' + charInsideUrl + '*' + charEndingUrl + ')(?=$|\\W)', 'gi')
    var emailPattern = /(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)/gi

    var markup = {
      'comment': /<!--[\w\W]*?-->/g,
      'tag': {
        pattern: /<\/?[\w:-]+\s*(?:\s+[\w:-]+(?:=(?:("|')(\\?[\w\W])*?\1|[^\s'">=]+))?\s*)*\/?>/gi,
        inside: {
          'tag': {
            pattern: /^<\/?[\w:-]+/i,
            inside: {
              'punctuation': /^<\/?/,
              'namespace': /^[\w-]+?:/
            }
          },
          'attr-value': {
            pattern: /=(?:('|")[\w\W]*?(\1)|[^\s>]+)/gi,
            inside: {
              'punctuation': /=|>|"/g
            }
          },
          'punctuation': /\/?>/g,
          'attr-name': {
            pattern: /[\w:-]+/g,
            inside: {
              'namespace': /^[\w-]+?:/
            }
          }
        }
      },
      'entity': /&#?[\da-z]{1,8};/gi
    }

    var latex = {
      // A tex command e.g. \foo
      'keyword': /\\(?:[^a-zA-Z]|[a-zA-Z]+)/g,
      // Curly and square braces
      'lparen': /[[({]/g,
      // Curly and square braces
      'rparen': /[\])}]/g,
      // A comment. Tex comments start with % and go to
      // the end of the line
      'comment': /%.*/g
    }

    function makeGrammars (options) {
      var grammars = {
        main: {},
        list: {},
        blockquote: {},
        table: {},
        deflist: {}
      }

      grammars.deflist.deflist = {
        pattern: new RegExp(
          [
            '^ {0,3}\\S.*\\n', // Description line
            '(?:[ \\t]*\\n)?', // Optional empty line
            '(?:',
            '[ \\t]*:[ \\t].*\\n', // Colon line
            '(?:',
            '(?:',
            '.*\\S.*\\n', // Non-empty line
            '|',
            '[ \\t]*\\n(?! ?\\S)', // Or empty line not followed by unindented line
            ')',
            ')*',
            '(?:[ \\t]*\\n)*', // Empty lines
            ')+'
          ].join(''),
          'm'
        ),
        inside: {
          term: /^.+/,
          cl: /^[ \t]*:[ \t]/gm
        }
      }

      var insideFences = options.insideFences || {}
      insideFences['cl cl-pre'] = /```|~~~/
      if (options.fence) {
        grammars.main['pre gfm'] = {
          pattern: /^(```|~~~)[\s\S]*?\n\1 *$/gm,
          inside: insideFences
        }
        grammars.list['pre gfm'] = grammars.deflist.deflist.inside['pre gfm'] = {
          pattern: /^(?: {4}|\t)(```|~~~)[\s\S]*?\n(?: {4}|\t)\1\s*$/gm,
          inside: insideFences
        }
      }

      grammars.main['h1 alt'] = {
        pattern: /^.+\n=+[ \t]*$/gm,
        inside: {
          'cl cl-hash': /=+[ \t]*$/
        }
      }
      grammars.main['h2 alt'] = {
        pattern: /^.+\n-+[ \t]*$/gm,
        inside: {
          'cl cl-hash': /-+[ \t]*$/
        }
      }
      for (var i = 6; i >= 1; i--) {
        grammars.main['h' + i] = {
          pattern: new RegExp('^#{' + i + '}[ \t].+$', 'gm'),
          inside: {
            'cl cl-hash': new RegExp('^#{' + i + '}')
          }
        }
      }

      var list = /^[ \t]*([*+\-]|\d+\.)[ \t]/gm
      var blockquote = {
        pattern: /^\s*>.*(?:\n[ \t]*\S.*)*/gm,
        inside: {
          'cl cl-gt': /^\s*>/gm,
          'cl cl-li': list
        }
      }
      grammars.list.blockquote = grammars.blockquote.blockquote = grammars.deflist.deflist.inside.blockquote = blockquote
      grammars.list['cl cl-li'] = grammars.blockquote['cl cl-li'] = grammars.deflist.deflist.inside['cl cl-li'] = list

      grammars.table.table = {
        pattern: new RegExp(
          [
            '^\\s*\\S.*[|].*\\n', // Header Row
            '[-| :]+\\n', // Separator
            '(?:.*[|].*\\n?)*', // Table rows
            '$'
          ].join(''),
          'gm'
        ),
        inside: {
          'cl cl-title-separator': /^[-| :]+$/gm,
          'cl cl-pipe': /[|]/gm
        }
      }

      grammars.main.hr = {
        pattern: /^ {0,3}([*\-_] *){3,}$/gm
      }

      var defs = {}
      if (options.footnote) {
        defs.fndef = {
          pattern: /^ {0,3}\[\^.*?\]:.*$/gm,
          inside: {
            'ref-id': {
              pattern: /^ {0,3}\[\^.*?\]/,
              inside: {
                cl: /(\[\^|\])/
              }
            }
          }
        }
      }
      if (options.abbr) {
        defs.abbrdef = {
          pattern: /^ {0,3}\*\[.*?\]:.*$/gm,
          inside: {
            'abbr-id': {
              pattern: /^ {0,3}\*\[.*?\]/,
              inside: {
                cl: /(\*\[|\])/
              }
            }
          }
        }
      }
      defs.linkdef = {
        pattern: /^ {0,3}\[.*?\]:.*$/gm,
        inside: {
          'link-id': {
            pattern: /^ {0,3}\[.*?\]/,
            inside: {
              cl: /[\[\]]/
            }
          },
          url: urlPattern
        }
      }

      defs.cl_each(function (def, name) {
        grammars.main[name] = def
        grammars.list[name] = def
        grammars.blockquote[name] = def
        grammars.table[name] = def
        grammars.deflist[name] = def
      })

      grammars.main.pre = {
        pattern: /^\s*\n(?: {4}|\t).*\S.*\n((?: {4}|\t).*\n)*/gm
      }

      var rest = {}
      rest.code = {
        pattern: /(`+)[\s\S]*?\1/g,
        inside: {
          'cl cl-code': /`/
        }
      }
      if (options.math) {
        rest['math block'] = {
          pattern: /\\\\\[[\s\S]*?\\\\\]/g,
          inside: {
            'cl cl-bracket-start': /^\\\\\[/,
            'cl cl-bracket-end': /\\\\\]$/,
            rest: latex
          }
        }
        rest['math inline'] = {
          pattern: /\\\\\([\s\S]*?\\\\\)/g,
          inside: {
            'cl cl-bracket-start': /^\\\\\(/,
            'cl cl-bracket-end': /\\\\\)$/,
            rest: latex
          }
        }
        rest['math expr block'] = {
          pattern: /(\$\$)[\s\S]*?\1/g,
          inside: {
            'cl cl-bracket-start': /^\$\$/,
            'cl cl-bracket-end': /\$\$$/,
            rest: latex
          }
        }
        rest['math expr inline'] = {
          pattern: /\$(?!\s)[\s\S]*?\S\$(?!\d)/g,
          inside: {
            'cl cl-bracket-start': /^\$/,
            'cl cl-bracket-end': /\$$/,
            rest: latex
          }
        }
        rest['latex block'] = {
          pattern: /\\begin\{([a-z]*\*?)\}[\s\S]*?\\?\\end\{\1\}/g,
          inside: {
            'keyword': /\\(begin|end)/,
            rest: latex
          }
        }
      }
      if (options.footnote) {
        rest.inlinefn = {
          pattern: /\^\[.+?\]/g,
          inside: {
            'cl': /(\^\[|\])/
          }
        }
        rest.fn = {
          pattern: /\[\^.+?\]/g,
          inside: {
            'cl': /(\[\^|\])/
          }
        }
      }
      rest.img = {
        pattern: /!\[.*?\]\(.+?\)/g,
        inside: {
          'cl cl-title': /['‘][^'’]*['’]|["“][^"”]*["”](?=\)$)/,
          'cl cl-src': {
            pattern: /(\]\()[^\('" \t]+(?=[\)'" \t])/,
            lookbehind: true
          }
        }
      }
      rest.link = {
        pattern: /\[.*?\]\(.+?\)/gm,
        inside: {
          'cl cl-underlined-text': {
            pattern: /(\[)[^\]]*/,
            lookbehind: true
          },
          'cl cl-title': /['‘][^'’]*['’]|["“][^"”]*["”](?=\)$)/
        }
      }
      rest.imgref = {
        pattern: /!\[.*?\][ \t]*\[.*?\]/g
      }
      rest.linkref = {
        pattern: /\[.*?\][ \t]*\[.*?\]/g,
        inside: {
          'cl cl-underlined-text': {
            pattern: /^(\[)[^\]]*(?=\][ \t]*\[)/,
            lookbehind: true
          }
        }
      }
      rest.comment = markup.comment
      rest.tag = markup.tag
      rest.url = urlPattern
      rest.email = emailPattern
      rest.strong = {
        pattern: /(^|[^\w*])(__|\*\*)(?![_\*])[\s\S]*?\2(?=([^\w*]|$))/gm,
        lookbehind: true,
        inside: {
          'cl cl-strong cl-start': /^(__|\*\*)/,
          'cl cl-strong cl-close': /(__|\*\*)$/
        }
      }
      rest.em = {
        pattern: /(^|[^\w*])(_|\*)(?![_\*])[\s\S]*?\2(?=([^\w*]|$))/gm,
        lookbehind: true,
        inside: {
          'cl cl-em cl-start': /^(_|\*)/,
          'cl cl-em cl-close': /(_|\*)$/
        }
      }
      rest['strong em'] = {
        pattern: /(^|[^\w*])(__|\*\*)(_|\*)(?![_\*])[\s\S]*?\3\2(?=([^\w*]|$))/gm,
        lookbehind: true,
        inside: {
          'cl cl-strong cl-start': /^(__|\*\*)(_|\*)/,
          'cl cl-strong cl-close': /(_|\*)(__|\*\*)$/
        }
      }
      rest['strong em inv'] = {
        pattern: /(^|[^\w*])(_|\*)(__|\*\*)(?![_\*])[\s\S]*?\3\2(?=([^\w*]|$))/gm,
        lookbehind: true,
        inside: {
          'cl cl-strong cl-start': /^(_|\*)(__|\*\*)/,
          'cl cl-strong cl-close': /(__|\*\*)(_|\*)$/
        }
      }
      if (options.del) {
        rest.del = {
          pattern: /(^|[^\w*])(~~)[\s\S]*?\2(?=([^\w*]|$))/gm,
          lookbehind: true,
          inside: {
            'cl': /~~/,
            'cl-del-text': /[^~]+/
          }
        }
      }
      if (options.sub) {
        rest.sub = {
          pattern: /(~)(?=\S)(.*?\S)\1/gm,
          inside: {
            'cl': /~/
          }
        }
      }
      if (options.sup) {
        rest.sup = {
          pattern: /(\^)(?=\S)(.*?\S)\1/gm,
          inside: {
            'cl': /\^/
          }
        }
      }
      rest.entity = markup.entity

      for (var c = 6; c >= 1; c--) {
        grammars.main['h' + c].inside.rest = rest
      }
      grammars.main['h1 alt'].inside.rest = rest
      grammars.main['h2 alt'].inside.rest = rest
      grammars.table.table.inside.rest = rest
      grammars.main.rest = rest
      grammars.list.rest = rest
      grammars.blockquote.blockquote.inside.rest = rest
      grammars.deflist.deflist.inside.rest = rest
      if (options.footnote) {
        grammars.main.fndef.inside.rest = rest
      }

      var restLight = {
        code: rest.code,
        inlinefn: rest.inlinefn,
        fn: rest.fn,
        link: rest.link,
        linkref: rest.linkref
      }
      rest.strong.inside.rest = restLight
      rest.em.inside.rest = restLight
      if (options.del) {
        rest.del.inside.rest = restLight
      }

      var inside = {
        code: rest.code,
        comment: rest.comment,
        tag: rest.tag,
        strong: rest.strong,
        em: rest.em,
        del: rest.del,
        sub: rest.sub,
        sup: rest.sup,
        entity: markup.entity
      }
      rest.link.inside['cl cl-underlined-text'].inside = inside
      rest.linkref.inside['cl cl-underlined-text'].inside = inside

      return grammars
    }

    return clMarkdownGrammarSvc
  })
