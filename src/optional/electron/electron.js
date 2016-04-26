angular.module('classeur.optional.electron', [])
  .directive('clLocalFileAlert',
    function ($timeout, clEditorLayoutSvc, clLocalSettingSvc) {
      return {
        restrict: 'E',
        scope: true,
        template: '<cl-local-file-alert-panel ng-if="editorLayoutSvc.currentControl === \'localFileAlert\'"></cl-read-only-alert-panel>',
        link: link
      }

      function link (scope) {
        scope.dismiss = function () {
          clLocalSettingSvc.values.localFileAlertDismissed = true
          clEditorLayoutSvc.currentControl = undefined
        }

        scope.$watch('currentFile.state === "loaded"', function (loaded) {
          if (!clLocalSettingSvc.values.localFileAlertDismissed && scope.currentFile && scope.currentFile.isLocalFile && loaded) {
            $timeout(function () {
              clEditorLayoutSvc.currentControl = 'localFileAlert'
            }, 1000)
          }
        })
      }
    })
  .directive('clLocalFileAlertPanel',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'optional/electron/localFileAlertPanel.html'
      }
    })
  .config(
    function ($routeProvider) {
      var clElectron = window.clElectron
      if (!clElectron) {
        return
      }

      $routeProvider
        .when('/localFile', {
          template: '<cl-centered-spinner ng-if="::!fileLoaded"></cl-centered-spinner><cl-editor-layout ng-if="::fileLoaded"></cl-editor-layout>',
          controller: function ($scope, $timeout, $location, clFileSvc, clUid, clEditorLayoutSvc, clElectronSvc, clDialog, clEditorSvc, clEditorContentSvc) {
            if (!clElectronSvc.watchedFile) {
              return $location.url('')
            }
            function noop () {}

            var file = {
              id: clUid(),
              isLocalFile: true,
              path: clElectronSvc.watchedFile.path,
              name: clElectronSvc.watchedFile.path.split(/[\\\/]/).slice(-1)[0],
              content: clFileSvc.defaultContent(),
              readContent: noop,
              writeContent: noop,
              freeContent: noop,
              removeContent: noop
            }
            file.load = function () {
              if (file.state) {
                return
              }
              file.state = 'loading'
              $timeout(function () {
                if (file.state === 'loading') {
                  clElectronSvc.loadWatchedFile(file)
                  file.content.state = {}
                  file.state = 'loaded'
                }
              })
            }
            file.unload = function () {
              clElectron.stopWatching(this.path)
              this.state = undefined
            }
            $scope.loadFile(file)
            $scope.$watch('currentFile.state', function (state) {
              if (!state) {
                clElectronSvc.watchedFile = undefined
                return $location.url('')
              } else if (state === 'loaded') {
                var lastRead = clElectronSvc.watchedFile.lastRead
                $scope.$watch('electronSvc.watchedFile.lastRead', function (value) {
                  if (
                    lastRead !== value &&
                    clElectronSvc.watchedFile &&
                    file.path === clElectronSvc.watchedFile.path &&
                    clElectronSvc.serializeContent(file.content) !== clElectronSvc.watchedFile.content
                  ) {
                    var reloadDialog = clDialog.confirm()
                      .title('Reload from disk')
                      .content('The file has been modified externally.')
                      .ariaLabel('Reload from disk')
                      .ok('Reload')
                      .cancel('Discard')
                    clDialog.show(reloadDialog).then(function () {
                      clElectronSvc.loadWatchedFile(file)
                      clEditorContentSvc.applyContent(true)
                    })
                  }
                })
                clEditorLayoutSvc.init()
                $scope.fileLoaded = true
              }
            })
          }
        })
    })
  .run(
    function ($window, $rootScope, $location, $timeout, clElectronSvc, clToast, clSetInterval, clEditorSvc) {
      var clElectron = $window.clElectron
      if (!clElectron) {
        return
      }

      clElectron.addEventListener('error', function (error) {
        clToast(error)
        $rootScope.$apply()
      })

      $rootScope.electronSvc = clElectronSvc
      $rootScope.$watch('electronSvc.watchedFile.path', function (path) {
        if (path) {
          $rootScope.currentFile && $rootScope.currentFile.unload()
          $rootScope.currentFile = undefined
          $timeout(function () {
            $location.url('/localFile')
          })
        }
      })

      clElectron.addEventListener('file', function (file) {
        clElectronSvc.watchedFile = {
          path: file.path,
          content: file.content,
          lastRead: Date.now()
        }
        $rootScope.$apply()
      })

      clSetInterval(function () {
        if (!clElectronSvc.watchedFile || !$rootScope.currentFile) {
          return
        }
        var content = clElectronSvc.serializeContent($rootScope.currentFile.content)
        if (clElectronSvc.watchedFile.path === $rootScope.currentFile.path &&
          $rootScope.currentFile.content.savedContent !== content
        ) {
          $rootScope.currentFile.content.savedContent = content
          clElectron.saveFile({
            path: clElectronSvc.watchedFile.path,
            content: content
          })
        }
      }, 1000)

      $window.document.body.addEventListener('dragover', function (evt) {
        evt.preventDefault()
      })

      $window.document.body.addEventListener('drop', function (evt) {
        evt.preventDefault()
        var files = evt.dataTransfer.files
        files && files[0] && clElectron.startWatching(files[0].path)
      })

      var contextMenuItems = [{
        label: 'Cut',
        keystroke: 'Ctrl/Cmd+X',
        role: 'cut'
      }, {
        label: 'Copy',
        keystroke: 'Ctrl/Cmd+C',
        role: 'copy'
      }, {
        label: 'Paste',
        keystroke: 'Ctrl/Cmd+V',
        role: 'paste'
      }, {
        type: 'separator'
      }, {
        // 	label: 'Undo',
        // 	keystroke: 'Ctrl/Cmd+Z',
        // 	click: function() {
        // 		clEditorSvc.cledit.undoMgr.undo()
        // 	}
        // }, {
        // 	label: 'Redo',
        // 	keystroke: 'Ctrl/Cmd+Y',
        // 	click: function() {
        // 		clEditorSvc.cledit.undoMgr.redo()
        // 	}
        // }, {
        type: 'separator'
      }, {
        label: 'Bold',
        keystroke: 'Ctrl/Cmd+B',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('bold')
        }
      }, {
        label: 'Italic',
        keystroke: 'Ctrl/Cmd+I',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('italic')
        }
      }, {
        type: 'separator'
      }, {
        label: 'Blockquote',
        keystroke: 'Ctrl/Cmd+Q',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('quote')
        }
      }, {
        label: 'Code',
        keystroke: 'Ctrl/Cmd+K',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('code')
        }
      }, {
        label: 'Link',
        keystroke: 'Ctrl/Cmd+L',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('link')
        }
      }, {
        label: 'Image',
        keystroke: 'Ctrl/Cmd+G',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('image')
        }
      }, {
        type: 'separator'
      }, {
        label: 'Numbered list',
        keystroke: 'Ctrl/Cmd+O',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('olist')
        }
      }, {
        label: 'Bullet list',
        keystroke: 'Ctrl/Cmd+U',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('ulist')
        }
      }, {
        label: 'Heading',
        keystroke: 'Ctrl/Cmd+H',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('heading')
        }
      }, {
        label: 'Horizontal rule',
        keystroke: 'Ctrl/Cmd+R',
        click: function () {
          clEditorSvc.pagedownEditor.uiManager.doClick('hr')
        }
      }]

      var showContextMenu = $window.cledit.Utils.debounce(function () {
        var selectedText = clEditorSvc.cledit.selectionMgr.getSelectedText()
        clElectron.showContextMenu(contextMenuItems, selectedText, function (correction) {
          if (selectedText === clEditorSvc.cledit.selectionMgr.getSelectedText()) {
            clEditorSvc.cledit.replace(
              clEditorSvc.cledit.selectionMgr.selectionStart,
              clEditorSvc.cledit.selectionMgr.selectionEnd,
              correction
            )
          }
        })
      }, 100)

      $window.addEventListener('contextmenu', function (e) {
        if (clEditorSvc.editorElt && clEditorSvc.editorElt.contains(e.target)) {
          e.preventDefault()
          showContextMenu()
        }
      })

      clElectron.addEventListener('version', function (version) {
        version
        $rootScope.$apply()
      })

      // Tells the app is ready
      clElectron.getVersion()
    })
  .factory('clElectronSvc', function (clDiffUtils) {
    return {
      loadWatchedFile: function (file) {
        file.content.savedContent = this.watchedFile.content
        var parsedContent = this.watchedFile.content.match(/^([\s\S]*?)(?:<!--cldata:(.*)-->)?\s*$/)
        file.content.text = parsedContent[1]
        try {
          var parsedAttributes = JSON.parse(decodeURI(parsedContent[2]))
          file.content.properties = parsedAttributes.properties || {}
          file.content.discussions = parsedAttributes.discussions || {}
          file.content.comments = parsedAttributes.comments || {}
          // Upgrade discussions to new format
          file.content.discussions && file.content.discussions.cl_each(function (discussion) {
            if (discussion.patches) {
              discussion.offset0 = clDiffUtils.patchToOffset(file.content.text, discussion.patches[0])
              discussion.offset1 = clDiffUtils.patchToOffset(file.content.text, discussion.patches[1])
              delete discussion.patches
            }
          })
        } catch (e) {
          file.content.properties = {}
          file.content.discussions = {}
          file.content.comments = {}
        }
      },
      serializeContent: function (content) {
        var text = content.text
        var attributes = {}
        if (Object.keys(content.properties).length) {
          attributes.properties = content.properties
        }
        if (Object.keys(content.discussions).length) {
          attributes.discussions = content.discussions
        }
        if (Object.keys(content.comments).length) {
          attributes.comments = content.comments
        }
        if (Object.keys(attributes).length) {
          text += '<!--cldata:' + encodeURI(JSON.stringify(attributes)) + '-->'
        }
        return text
      }
    }
  })
