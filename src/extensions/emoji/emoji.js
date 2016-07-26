angular.module('classeur.extensions.emoji', [])
  .config(function (clExtensionSvcProvider) {
    var twemojiScript, twemoji

    clExtensionSvcProvider.onGetOptions(function (options, properties, isCurrentFile) {
      options.emoji = properties['ext:emoji'] === 'true'
      options.emojiShortcuts = properties['ext:emoji:shortcuts'] !== 'false'
    })

    function initTwemoji () {
      if (!twemojiScript) {
        twemojiScript = document.createElement('script')
        twemojiScript.src = 'https://twemoji.maxcdn.com/twemoji.min.js'
        twemojiScript.onload = function () {
          twemoji = window.twemoji
          document.querySelectorAll('.cl-preview-section').cl_each(function (elt) {
            twemoji.parse(elt)
          })
        }
        twemojiScript.onerror = function () {
          twemojiScript = undefined
        }
        document.head.appendChild(twemojiScript)
      }
    }

    clExtensionSvcProvider.onInitConverter(1, function (markdown, options, isCurrentFile) {
      if (options.emoji) {
        var emojiOptions = {}
        if (!options.emojiShortcuts) {
          emojiOptions.shortcuts = {}
        }
        markdown.use(window.markdownitEmoji, emojiOptions)
        if (isCurrentFile) {
          initTwemoji()
        }
      }
    })

    clExtensionSvcProvider.onSectionPreview(function (elt, options) {
      if (options.emoji && twemoji) {
        twemoji.parse(elt)
      }
    })
  })
