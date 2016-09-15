angular.module('classeur.optional.exportToDisk', [])
  .directive('clExportToDisk',
    function ($window, clDialog, clToast, clUserSvc, clEditorLayoutSvc, clSocketSvc, clEditorSvc, clSettingSvc, clTemplateManagerDialog, clLocalSettingSvc) {
      var mimeTypes = {
        asciidoc: 'text/plain',
        epub: 'application/epub+zip',
        epub3: 'application/epub+zip',
        html: 'text/html',
        latex: 'application/x-latex',
        odt: 'application/vnd.oasis.opendocument.text',
        pdf: 'application/pdf',
        rst: 'text/plain',
        rtf: 'application/rtf',
        textile: 'text/plain',
        txt: 'text/plain',
        md: 'text/plain',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }

      function saveAs (byteString, name, format) {
        var mimeType = mimeTypes[format]
        var buffer = new ArrayBuffer(byteString.length)
        var view = new Uint8Array(buffer)
        for (var i = 0; i < byteString.length; i++) {
          view[i] = byteString.charCodeAt(i)
        }
        var blob = new $window.Blob([view], {
          type: mimeType
        })
        var extension = '.' + format
        if (name.slice(-extension.length) !== extension) {
          name += extension
        }
        $window.saveAs(blob, name)
      }

      clSocketSvc.addMsgHandler('document', function (msg) {
        if (msg.error) {
          return setTimeout(function () {
            clToast(msg.error.slice(0, 100))
          }, 500) // Make toast is not overlapping previous one
        }
        saveAs($window.atob(msg.content), msg.name, msg.format)
      })

      return {
        restrict: 'E',
        link: link
      }

      function link (scope) {
        function closeDialog () {
          clEditorLayoutSvc.currentControl = undefined
        }

        function openDialog () {
          if (clEditorLayoutSvc.currentControl !== 'exportToDisk') {
            clEditorLayoutSvc.currentControl = 'exportToDisk'
            return
          }

          clDialog.show({
            templateUrl: 'optional/exportToDisk/exportToDisk.html',
            controller: ['$scope', function (scope) {
              scope.appliedTemplate = ''
              scope.templates = clSettingSvc.values.exportTemplates
              scope.localSettingSvc = clLocalSettingSvc
              scope.export = function () {
                clDialog.hide(scope.appliedTemplate)
              }
              scope.cancel = function () {
                clDialog.cancel()
              }
              scope.manageTemplates = function () {
                clTemplateManagerDialog(clSettingSvc.values.exportTemplates)
                  .then(function (templates) {
                    clSettingSvc.values.exportTemplates = templates
                    openDialog()
                  }, openDialog)
              }
              scope.$watch('localSettingSvc.values.exportTemplateKey', function (templateKey) {
                var template = clSettingSvc.values.exportTemplates[templateKey]
                clEditorSvc.applyTemplate(template || '')
                  .then(function (text) {
                    scope.appliedTemplate = text
                  })
              })
              scope.onCopySuccess = function () {
                clToast('Copied!')
              }
              scope.onCopyError = function () {
                clToast('Unable to copy to clipboard.')
              }
            }]
          })
            .then(function (appliedTemplate) {
              closeDialog()
              if (clLocalSettingSvc.values.exportFormat === 'template') {
                appliedTemplate = unescape(encodeURIComponent(appliedTemplate)) // UTF-8 to ByteString
                saveAs(appliedTemplate, scope.currentFile.name, 'html')
              } else if (clLocalSettingSvc.values.exportFormat === 'document') {
                var ast = clEditorSvc.getPandocAst()
                var content = scope.currentFile.content
                if (!clUserSvc.user) {
                  return clDialog.show({
                    templateUrl: 'optional/exportToDisk/premiumPdfDialog.html',
                    controller: ['$scope', function (scope) {
                      scope.userSvc = clUserSvc
                      scope.cancel = function () {
                        clDialog.cancel()
                      }
                    }]
                  })
                }
                if (!clSocketSvc.isReady) {
                  return clToast('You appear to be offline.')
                }
                clToast('Your document is being prepared...')
                clSocketSvc.sendMsg('toDocument', {
                  name: scope.currentFile.name,
                  format: clLocalSettingSvc.values.exportDocumentFormatKey,
                  options: {
                    highlightStyle: clSettingSvc.values.pandocHighlightStyle,
                    toc: clSettingSvc.values.pandocToc,
                    tocDepth: clSettingSvc.values.pandocTocDepth
                  },
                  metadata: content.properties,
                  ast: ast
                })
              }
            }, closeDialog)
        }

        scope.$watch('editorLayoutSvc.currentControl === "exportToDisk"', function (value) {
          value && openDialog()
        })
      }
    })
